#!/usr/bin/env node
// Story: hooks/quiet-output.md steps 1–18 (the hook half). Fails OPEN (spec I17).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify, classifySegments, isSimpleCompound, isNever } from './lib/classify.mjs';
import { readPayload } from './lib/stdin.mjs';
import { updatedInput } from './lib/emit.mjs';
import { projectRoot } from './lib/root.mjs';
import { loadCatalog } from './lib/catalog.mjs';
import { loadObservations } from './lib/observations.mjs';
import { decide } from './lib/assimilate.mjs';

// The project root and its catalog, resolved at most ONCE per hook run and only when something asks
// — classify()'s catalog step, or the assimilator — because resolving the root is a git spawn and
// the catalog is two file reads, and a command the chain answers before the catalog step (never,
// read) never needs either (re-review R4). That list was `never, piped, redirected, read` until
// #160 deleted the two syntax exemptions: a `> file` or `| filter` command reaches the catalog step
// now, like any other. Outside a repository there is no
// project half to overlay and no record to keep, so the catalog is empty and the assimilator is not
// consulted — the regex chain alone answers, as it always did there. That is the one throw swallowed
// here on purpose; anything else reaches the catch at the bottom.
function projectLoader() {
  let loaded = null;
  return () => {
    if (!loaded) {
      let root = null;
      try { root = projectRoot(process.cwd()); } catch { /* not inside a repository */ }
      loaded = { root, catalog: root ? loadCatalog(root) : {} };
    }
    return loaded;
  };
}

// classify() says 'plain' about three things: a command it simply does not recognise, whose volume
// is UNKNOWN rather than quiet (specs/2026-09-04-tool-assimilation-design.md, "The default is also
// backwards"); a command the catalog knows, which the catalog — not the regexes — is the authority
// on (ruling I1, 2026-09-05); and one the NEVER list exempts outright. Only the first two are the
// assimilator's business, and only inside a repository. Returns the wrap mode, or null for "leave
// this command alone".
function assimilated(command, load) {
  if (isNever(command)) return null;
  const { root, catalog } = load();
  if (!root) return null;
  const d = decide(command, { catalog, observations: loadObservations(root) });
  if (d.mode === 'plain') return null;              // seen here, and it was quiet
  return d.mode === 'noisy' ? 'filter' : d.mode;    // 'filter' | 'observe' | 'suggest'
}

// The wrap mode one unit of command text earns from its kind — the whole command on PowerShell, one
// segment on bash — or null for "leave it alone". The kind is classify()'s; 'plain' is the
// assimilator's question, answered above.
const modeFor = (kind, text, load) =>
  (kind === 'infra' ? 'infra' : kind === 'noisy' ? 'filter' : kind === 'plain' ? assimilated(text, load) : null);

// Each wrapped unit gets a cmdfile of its own, named for this hook run and its position, because
// two segments wrapped in the same millisecond would otherwise share a name (#13).
function cmdfileWriter() {
  const job = process.env.CLAUDE_JOB_DIR;
  const dir = job ? path.join(job, 'tmp') : path.join(os.tmpdir(), 'claude-quiet');
  const stamp = `cmd-${process.pid}-${Date.now()}`;
  let made = false;
  return (text, i) => {
    if (!made) { fs.mkdirSync(dir, { recursive: true }); made = true; }
    const f = path.join(dir, `${stamp}-${i}.txt`);
    fs.writeFileSync(f, text, 'utf8');
    return f;
  };
}

function main() {
  const p = readPayload();
  if (!p) return;
  const tool = p.tool_name;
  if (tool !== 'Bash' && tool !== 'PowerShell') return;
  const input = p.tool_input ?? {};
  const command = input.command ?? '';
  const load = projectLoader();
  const catalog = () => load().catalog;
  const runner = path.join(path.dirname(fileURLToPath(import.meta.url)), 'quiet-run.mjs');
  const tag = (modes) => `${input.description ?? ''} [quiet:${modes.join(',')}]`.trim();
  const bash = (f) => f.replace(/\\/g, '/');

  // The whole-command path, exactly as it was before #13: one kind for the whole command, one
  // cmdfile, one runner. PowerShell always takes it — scope rule (b): 5.1 has no `&&` or `||`, so
  // there is no per-segment control flow for the shell to own. A bash compound takes it when it is
  // not made of simple commands (fix round 1, A, below): the runner then runs the whole thing in
  // one shell as before, and learning happens on the compound as a unit, as it always did.
  const whole = (shell) => {
    const mode = modeFor(classify(command, { catalog }), command, load);
    if (!mode) return;
    const file = cmdfileWriter()(command, 0);
    const cmd = shell === 'bash'
      ? `node "${bash(runner)}" --shell bash --mode ${mode} "${bash(file)}"`
      : `node "${runner}" --shell powershell --mode ${mode} "${file}"; exit $LASTEXITCODE`;
    updatedInput({ ...input, command: cmd, description: tag([mode]) });
  };
  if (tool === 'PowerShell') return whole('powershell');

  // Issue #13 (owner, 2026-09-05: "apply the rules to inside the compound. so each outputter gets
  // wrapped"). Every `;`/`&&`/`||`/newline-joined segment is classified on its own and the ones
  // that earn a mode are each wrapped in a runner of their own; the rest stay verbatim and the
  // separators are rejoined exactly as written, so bash runs its own control flow over the runners
  // — each exits with its child's real code, which is what `&&` and `||` short-circuit on. A pipe
  // is one unit, as it always was.
  //
  // Fix round 1 (controller's amendment after review, 2026-09-05). A: a separator outside quotes is
  // not always a command boundary — `if x; then y; fi`, a `{ }` group, a `$( )` split by `&&`, a
  // heredoc whose body lines are "segments" — and cutting one of those into runners produced a
  // syntax error, or a file full of runner invocations. Per-segment is therefore for compounds of
  // simple commands only, classify.mjs's isSimpleCompound() says which, and anything else takes
  // the whole-command path above. C: a lone `&` backgrounds the whole AND-OR list ending at it, not
  // the last segment, so nothing in that list is wrapped: walking forward from a segment over `&&`
  // and `||`, reaching `&` before `;`, a newline or the end means backgrounded. A backgrounded
  // runner's output is detached from the tool result anyway, and two runners alive at once would
  // race on observations.json — quiet-run.mjs reads it, records, and writes it back with no lock,
  // so the second writer would silently drop the first one's record. B lives in classify.mjs, as
  // amended in round 2: a state-mutating segment whose effect crosses a process boundary
  // (`export`, `cd`, `umask`, …) comes back 'read' and is left verbatim, so its effect reaches the
  // runners after it; one whose effect stays in its own shell (`X=1`, `source`, `set`, `shopt`, …)
  // makes the compound not simple, so the whole of it runs in one shell above. Round 2 also made a
  // `#` comment a span in the one scanner: a separator inside one never splits, and a
  // comment-only segment is folded away by classifySegments() — never wrapped, never recorded.
  const segments = classifySegments(command, { catalog });
  if (!isSimpleCompound(segments)) return whole('bash');
  const backgrounded = (i) => {
    for (let j = i; j < segments.length; j++) {
      const s = segments[j].sep.trim();
      if (s === '&') return true;
      if (s !== '&&' && s !== '||') return false;
    }
    return false;
  };
  const modes = segments.map((s, i) => (backgrounded(i) ? null : modeFor(s.kind, s.text, load)));
  if (!modes.some(Boolean)) return;
  const write = cmdfileWriter();
  // `lead` is the blank or comment folded in front of a segment (fix round 3): re-emitted verbatim
  // where it was, never inside a cmdfile, so the judged text and the wrapped text are one text.
  const rebuilt = segments.map((s, i) => s.lead + (modes[i]
    ? `node "${bash(runner)}" --shell bash --mode ${modes[i]} "${bash(write(s.text, i))}"${s.sep}`
    : s.text + s.sep)).join('');
  updatedInput({ ...input, command: rebuilt, description: tag(modes.filter(Boolean)) });
}

// Fail OPEN — the command runs unfiltered — but never silent (final review I2): a swallowed error
// here used to look exactly like a command that needed no wrapping, and one malformed catalog
// entry switched assimilation off for a whole project without a word. One line, naming the cause.
try { main(); } catch (e) { process.stderr.write(`quiet: hook failed (${e?.message ?? String(e)}); the command runs unfiltered\n`); }
process.exitCode = 0;
