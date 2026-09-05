#!/usr/bin/env node
// Story: hooks/quiet-output.md steps 1–18 (the hook half). Fails OPEN (spec I17).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify, classifySegments, isNever } from './lib/classify.mjs';
import { readPayload } from './lib/stdin.mjs';
import { updatedInput } from './lib/emit.mjs';
import { projectRoot } from './lib/root.mjs';
import { loadCatalog } from './lib/catalog.mjs';
import { loadObservations } from './lib/observations.mjs';
import { decide } from './lib/assimilate.mjs';

// The project root and its catalog, resolved at most ONCE per hook run and only when something asks
// — classify()'s catalog step, or the assimilator — because resolving the root is a git spawn and
// the catalog is two file reads, and a command the chain answers before the catalog step (never,
// piped, redirected, read) never needs either (re-review R4). Outside a repository there is no
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

  // Scope rule (b) of #13: PowerShell keeps whole-command behaviour. 5.1 has no `&&` or `||`, so
  // there is no per-segment control flow for the shell to own, and this path is left as it was.
  if (tool === 'PowerShell') {
    const mode = modeFor(classify(command, { catalog }), command, load);
    if (!mode) return;
    const file = cmdfileWriter()(command, 0);
    updatedInput({ ...input, command: `node "${runner}" --shell powershell --mode ${mode} "${file}"; exit $LASTEXITCODE`, description: tag([mode]) });
    return;
  }

  // Issue #13 (owner, 2026-09-05: "apply the rules to inside the compound. so each outputter gets
  // wrapped"). Every `;`/`&&`/`||`/newline-joined segment is classified on its own and the ones
  // that earn a mode are each wrapped in a runner of their own; the rest stay verbatim and the
  // separators are rejoined exactly as written, so bash runs its own control flow over the runners
  // — each exits with its child's real code, which is what `&&` and `||` short-circuit on. A pipe
  // is one unit, as it always was. Scope rule (a): a segment followed by a lone `&` is NEVER
  // wrapped. Its output is detached from the tool result anyway, and two runners alive at once
  // would race on observations.json — quiet-run.mjs reads it, records, and writes it back with
  // no lock, so the second writer would silently drop the first one's record.
  const segments = classifySegments(command, { catalog });
  const modes = segments.map((s) => (s.sep.trim() === '&' ? null : modeFor(s.kind, s.text, load)));
  if (!modes.some(Boolean)) return;
  const write = cmdfileWriter();
  const bash = (f) => f.replace(/\\/g, '/');
  const rebuilt = segments.map((s, i) => (modes[i]
    ? `node "${bash(runner)}" --shell bash --mode ${modes[i]} "${bash(write(s.text, i))}"${s.sep}`
    : s.text + s.sep)).join('');
  updatedInput({ ...input, command: rebuilt, description: tag(modes.filter(Boolean)) });
}

// Fail OPEN — the command runs unfiltered — but never silent (final review I2): a swallowed error
// here used to look exactly like a command that needed no wrapping, and one malformed catalog
// entry switched assimilation off for a whole project without a word. One line, naming the cause.
try { main(); } catch (e) { process.stderr.write(`quiet: hook failed (${e?.message ?? String(e)}); the command runs unfiltered\n`); }
process.exitCode = 0;
