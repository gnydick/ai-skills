// Story: hooks/quiet-output.md steps 4–14. Precedence is the ORDER below and nowhere else
// (spec I10, I18): never → piped → redirected → read → catalog → infra → noisy → plain.
// 'read' has two sources at the same step: the gh reads, and — ruling C1, owner 2026-09-05,
// "Only need wrapping for output producers, not filter pipes" — the byte-movers in READ below.
// 'catalog' is ruling I1, owner 2026-09-05: a command with a verified catalog entry is 'plain'
// (the bucket that hands off to the assimilator) because that entry is the authority on the tool;
// the regex chain after it is the fallback for tools nobody has characterised. Read runs before
// the catalog on purpose: a byte-mover is exempt even if someone catalogs it.
import { matchTool } from './catalog.mjs';
import { splitOutside, segmentsOutside, maskOutside } from './quotes.mjs';

const LEAD = String.raw`(?:^|[;&|(]\s*|\bthen\s+|\bdo\s+|&&\s*)\s*(?:\w+=\S*\s+)*`;
// The token ends here: `cat` is a byte-mover, `catalog-tool` is not, and `\b` alone would admit
// `cat-fish`. `env` is a byte-mover only alone (or with flags) — `env VAR=x cmd` runs cmd — and
// `git branch` only when every argument is a flag: `git branch -d x` and `git branch x` do work.
const END = String.raw`(?=\s|$|[;&|)])`;
const READ = new RegExp(LEAD + String.raw`(?:` +
  String.raw`(?:cat|grep|rg|sed|awk|head|tail|sort|uniq|cut|tr|wc|jq|find|diff|ls|pwd|echo|printf|less|more|tee|xargs` +
  String.raw`|basename|dirname|realpath|stat|file|which|type|printenv|date|test|\[|true|false` +
  String.raw`|cd|mkdir|rmdir|rm|cp|mv|touch|ln|chmod)` + END +
  String.raw`|env(?:\s+-\S+)*\s*(?:$|[;&|)])` +
  String.raw`|git\s+(?:-C\s+\S+\s+)?(?:log|diff|show|status|blame|ls-files|rev-parse|worktree\s+list)` + END +
  String.raw`|git\s+(?:-C\s+\S+\s+)?branch(?:\s+-\S+)*\s*(?:$|[;&|)])` +
  String.raw`)`);
// Fix round 1 for #13 (controller's amendment after review, 2026-09-05), B: a state-mutating builtin
// changes the shell it runs in — the reviewer measured `export PROBE_VAR=set && node -e …` printing
// `var=undefined` once each segment had a runner of its own, because the export happened in a shell
// nobody else saw. These are 'read' too: the hook's treatment is the same (untouched, unobserved, no
// record), and a second kind for one treatment would be a second name for one bucket; the list is
// its own named thing so it can be read as one. Tested over the outside-quotes mask, so `X="a && b"`
// is one assignment and `echo "export"` is not one. A bare assignment is one or more `NAME=value`
// with NO command after them; a substitution in the value — `X=$(git rev-parse HEAD)`, backticks,
// `${…}` — is folded to one token first, innermost first, so its spaces do not read as a command.
// An assignment that PREFIXES a command (`X=1 cargo build`) is that command, exactly as LEAD says.
//
// Fix round 2 (controller's amendment after re-review, 2026-09-05), B: leaving the segment verbatim
// is necessary, not sufficient. Only exported env, the cwd, umask and ulimit cross into the
// runner's fresh `bash -lc`; the reviewer measured `PROBE3=assigned; node -e … "$PROBE3"` printing
// `bare=` where main printed `bare=assigned`, and `shopt -s nullglob; node … *.nomatch` giving
// `argc=1` where main gave `argc=0`. So the list is split by whether the effect crosses a process
// boundary. CROSSING stays per-segment, verbatim. LOCAL — and a bare assignment, whose variable
// lives in this shell only — makes the compound NOT simple (isSimpleCommand below, the one decision
// point), so the whole compound takes the whole-command path and runs in one shell, as before #13.
// To classify() on its own, every one of them is still 'read'.
const CROSSING = String.raw`export|cd|pushd|popd|umask|ulimit`;
const LOCAL = String.raw`source|\.|set|unset|shopt|alias|unalias|declare|typeset|readonly|local|eval|exec|trap`;
const STATE_CROSSING = new RegExp(String.raw`^\s*(?:${CROSSING})(?=\s|$)`);
const STATE_LOCAL = new RegExp(String.raw`^\s*(?:(?:${LOCAL})(?=\s|$)|(?:\w+=\S*\s*)+$)`);
const SUBSTITUTION = /\$\([^()]*\)|\$\{[^{}]*\}|`[^`]*`/g;
const folded = (segment) => {
  let mask = maskOutside(segment), next;
  while ((next = mask.replace(SUBSTITUTION, '_')) !== mask) mask = next;
  return mask;
};
const isLocalState = (segment) => STATE_LOCAL.test(folded(segment));
const isState = (segment) => STATE_CROSSING.test(folded(segment)) || isLocalState(segment);
// A whole command is a byte-mover only if every segment of it is. This is classify()'s answer for
// the command as ONE unit: the hook asks it for PowerShell and for a compound it cannot take apart
// (isSimpleCompound below), and asks classifySegments() for each segment of a bash compound it can
// (#13). Recognised at LEAD like the other regexes — but tested per segment, because LEAD matching
// ANYWHERE would make `cargo build && echo done` a read and unwrap the build; the exemption is by
// kind, and a compound with an output producer in it is not of that kind. Pipes are not split here:
// a `|` was already 'piped' at the step above. A trailing separator or newline (`cat a;`, `ls\n`)
// leaves a whitespace-only segment that names no command; it is not counted, or `READ.test('')`
// fails the `every` and the byte-mover is observed (re-review R1). A command with no segment left
// at all is not a read: `every` over nothing is true. A single `&` is a boundary too, as LEAD
// already says it is (re-review R2: `cargo build & cat x` was one segment, and its LEAD-anchored
// `cat` made the backgrounded build a read) — but not the `&` of `&&`, and not the one inside a
// redirect (`2>&1`, `>&2`), which would leave a `1` segment. A separator inside a quoted span is
// data, not a boundary (issue #11: `echo "a && b"` split into `echo "a` and `b"`, neither a
// byte-mover, and an echo was observed unfiltered). What a span IS is not decided here:
// splitOutside() reads the one definition in quotes.mjs, the same one catalog.mjs's tokens() reads,
// so an unterminated quote runs to the end for both of them.
const SEGMENT = /\s*(?:;|&&|\|\||(?<![>&])&(?!&)|\r?\n)\s*/;
const isRead = (command) => {
  const segments = splitOutside(command, SEGMENT).filter((s) => s.trim() !== '');
  return segments.length > 0 && segments.every((s) => READ.test(s) || isState(s));
};

const NOISY = new RegExp(LEAD + String.raw`(?:` +
  String.raw`cargo\s+(?:\+\S+\s+)?(?:build|b|test|t|check|c|clippy|run|r|bench|doc|install|update|fetch|clean|nextest|fmt|llvm-cov|tarpaulin|xtask)\b` +
  String.raw`|(?:npm|pnpm|yarn|bun)\s+(?:install|i|ci|add|run|test|build|update|up|exec|create)\b` +
  String.raw`|npx\s+\S+` +
  String.raw`|pip3?\s+(?:install|download|wheel|uninstall)\b` +
  String.raw`|uv\s+(?:pip|sync|run|tool|add)\b` +
  String.raw`|(?:python3?|py)\s+-m\s+(?:pip|pytest|build|venv|unittest)\b` +
  String.raw`|pytest\b|tox\b|maturin\b|poetry\s+(?:install|run|build|update)\b` +
  String.raw`|(?:cmake\s+--build|make\b|ninja\b|msbuild\b|dotnet\s+(?:build|test|restore|run)|gradle\w*\b|mvn\b)` +
  String.raw`|docker\s+(?:build|pull|compose|push)\b` +
  String.raw`|git\s+(?:clone|fetch|pull)\b` +
  String.raw`|rustup\s+(?:update|install|toolchain|component)\b` +
  String.raw`|(?:python3?|py)\s+(?:-\S+\s+)*(?:\./|\.\./)?(?:scripts|\.claude/hooks)/\S*_test\.py\b` +
  String.raw`|sccache\s+--start-server\b` +
  String.raw`|gh\s+(?:run\s+(?:view|watch|download)|pr\s+checks|auth\s+status|extension\s+(?:install|upgrade))\b` +
  String.raw`)`);

const INFRA = new RegExp(LEAD +
  String.raw`(?:git\s+(?:-C\s+\S+\s+)?(?:commit|push|pull|fetch|merge|rebase|clone|cherry-pick|worktree\s+(?:add|remove|prune)|submodule)\b` +
  String.raw`|gh\s+(?:pr\s+(?:create|merge|close|ready|review|comment|edit)|issue\s+(?:create|edit|comment|close|reopen|transfer|pin|unpin|develop)|workflow\s+(?:run|enable|disable)|release\s+(?:create|upload|delete)|run\s+(?:rerun|cancel)|repo\s+(?:clone|fork|sync|create)|label\s+(?:create|clone|delete)|auth\s+(?:login|refresh|setup-git))\b)`);

const GH_READ = new RegExp(LEAD +
  String.raw`gh\s+(?:issue\s+(?:view|list|status)|pr\s+(?:view|list|diff|status)|api\b|search\b|release\s+(?:view|list)|run\s+list|repo\s+(?:view|list)|label\s+list|project\b|gist\s+(?:view|list)|workflow\s+(?:view|list))\b`);

const PIPED = /\|\s*(?:tail|head|grep|rg|wc|sed|awk|sort|uniq|jq|tee|less|cut|python|py|quiet[-_]run)\b/;
const NEVER = /quiet[-_]run\.(?:py|mjs)|--version\b|-V\b|--help\b/;
const FILE_REDIRECT = /\d?>\s*\S/;

export const MODES = Object.freeze(['read', 'piped', 'redirected', 'infra', 'noisy', 'plain']);

// NEVER collapses into 'plain' below, because both mean "do not wrap" to classify()'s own
// caller. They stop meaning the same thing the moment 'plain' also means "ask the assimilator":
// an exempted command would then be observed, and an already-wrapped one wrapped again. The
// exemption is exported rather than restated so there is one spelling of it (quiet.mjs), and
// classify() below asks it rather than re-testing NEVER: two spellings over one regex diverge the
// day the predicate grows a term the regex cannot carry, and nothing would report it.
export const isNever = (command) => !command || NEVER.test(command);

// `catalog` is the loaded tool catalog (universal + project overlay), passed by the one caller that
// loads it — quiet.mjs — so the file is read once, at one site, and this stays exercisable from a
// literal. It may be the catalog itself or a function returning it: the function is called only when
// the chain reaches the catalog step, so a command answered above it never pays for the load
// (re-review R4 — the root spawn and two file reads were being paid for `cat x` and `--help`). With
// no catalog the function is exactly what it was: a pure function of the string.
export function classify(command, { catalog } = {}) {
  if (isNever(command)) return 'plain';
  if (PIPED.test(command)) return 'piped';
  // quiet_hook.py:105 — a stderr-merge token cancels the redirect exemption entirely.
  if (command.includes('>') && FILE_REDIRECT.test(command) && !command.includes('2>&1')) return 'redirected';
  if (GH_READ.test(command) || isRead(command)) return 'read';
  const table = typeof catalog === 'function' ? catalog() : catalog;
  if (table && matchTool(command, table)) return 'plain';
  if (INFRA.test(command)) return 'infra';
  if (NOISY.test(command)) return 'noisy';
  return 'plain';
}

// Issue #13 (owner, 2026-09-05: "i would apply the rules to inside the compound. so each outputter
// gets wrapped. since it's && and not a pipe, it theoretically should be no problem"). classify()
// gives a whole command one kind, and the final review measured what that costs a compound: the
// catalog's `pytest` prefix on the first segment made `pytest tests/ && cargo build` 'plain', so
// the build ran unfiltered on its observe pass where alone it was 'noisy → filter'; and the read
// exemption above had to demand that EVERY segment be a byte-mover, because one verdict was all the
// compound could receive. This applies the same chain to each segment on its own. Segments are the
// SEGMENT boundaries above — `;`, `&&`, `||`, a single `&`, a newline, outside quotes — and a pipe is
// never one: `a | b` stays one unit and classifies 'piped' exactly as the whole command would.
// Each entry carries the separator that FOLLOWS its text, as matched, so the hook can rebuild the
// command around the segments it wraps with `text + sep` and get every byte back; the shell then
// runs its own `&&`/`||`/`;` over the runners. A whitespace-only segment names no command
// (re-review R1), and so does a comment-only one — a `#` comment is a span in quotes.mjs (#13 fix
// round 2), so the separators inside it never split, and what is left is a segment whose text
// starts with `#`; neither is ever classified, wrapped or observed. Each rides on a neighbour's
// separator so the rejoin stays the identity — the entry before it, or, for a leading one, the
// text of the entry after it, whose kind is then the kind of that entry's own command (bash
// ignores the comment or blank in front of it, and so does the classifier). The catalog is
// resolved at most once for the whole compound and only when a segment reaches the catalog step
// (re-review R4, held per compound rather than per segment). Whether a backgrounded segment
// (`sep` a lone `&`) may be wrapped is the hook's question, answered there, not here.
const NAMES_NOTHING = /^\s*(?:#|$)/;
export function classifySegments(command, { catalog } = {}) {
  let loaded = false, table;
  const once = () => { if (!loaded) { loaded = true; table = typeof catalog === 'function' ? catalog() : catalog; } return table; };
  const out = [];
  let lead = '';
  for (const { text, sep } of segmentsOutside(command, SEGMENT)) {
    if (NAMES_NOTHING.test(text)) {
      if (out.length) out[out.length - 1].sep += text + sep; else lead += text + sep;
      continue;
    }
    out.push({ text: lead + text, sep, kind: classify(text, { catalog: once }) });
    lead = '';
  }
  return out;
}

// Fix round 1 for #13 (controller's amendment after review, 2026-09-05), A: a separator outside
// quotes is not always a command boundary. The reviewer measured `if cargo build; then echo ok; fi`
// cut into three runners and bash refusing the result, and a heredoc whose body lines each became
// a runner — the file received runner invocations. So per-segment wrapping is for a compound of
// SIMPLE commands only, and this is the one predicate that says which. A segment is simple when it
// has no heredoc operator (`<<` or `<<-`; the herestring `<<<` is one token and allowed), balanced
// `(` `{` `[[` and an even number of backticks — all counted outside quotes — no reserved word at
// its lead, and no trailing continuation backslash. The lead list is bash's reserved words plus
// the openers and closers whose other half would be in another segment (`{` `}` `[[` `]]` `((`
// `))`): a `[[ … ]]` that is balanced within a segment is still a compound command in bash's
// grammar, and it takes the whole-command path with the rest. Fix round 2 (B): a segment leading
// with a state word whose effect does not cross a process boundary, or a bare assignment, is not
// simple either (STATE_LOCAL above) — its effect has to reach the segments after it, and only one
// shell can carry it. What the hook does with a compound that fails this test is its own decision
// (quiet.mjs): it wraps the whole command once, as it did before #13, so learning still happens on
// the compound as a unit.
const RESERVED_LEAD = /^\s*(?:if|then|elif|else|fi|for|while|until|do|done|case|esac|in|function|select|time|coproc|!|\{|\}|\[\[|\]\]|\(\(|\)\))(?=\s|$)/;
const HEREDOC = /(?<!<)<<(?!<)/;
const count = (mask, re) => (mask.match(re) ?? []).length;
export function isSimpleCommand(text) {
  const mask = maskOutside(text);
  if (RESERVED_LEAD.test(mask) || HEREDOC.test(mask) || mask.endsWith('\\') || isLocalState(text)) return false;
  if (count(mask, /\(/g) !== count(mask, /\)/g) || count(mask, /\{/g) !== count(mask, /\}/g)) return false;
  if (count(mask, /\[\[/g) !== count(mask, /\]\]/g)) return false;
  return count(mask, /`/g) % 2 === 0;
}
export const isSimpleCompound = (segments) => segments.every((s) => isSimpleCommand(s.text));
