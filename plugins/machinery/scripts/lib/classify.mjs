// Story: hooks/quiet-output.md steps 4–14. Precedence is the ORDER below and nowhere else
// (spec I10, I18): never → piped → redirected → read → catalog → infra → noisy → plain.
// 'read' has two sources at the same step: the gh reads, and — ruling C1, owner 2026-09-05,
// "Only need wrapping for output producers, not filter pipes" — the byte-movers in READ below.
// 'catalog' is ruling I1, owner 2026-09-05: a command with a verified catalog entry is 'plain'
// (the bucket that hands off to the assimilator) because that entry is the authority on the tool;
// the regex chain after it is the fallback for tools nobody has characterised. Read runs before
// the catalog on purpose: a byte-mover is exempt even if someone catalogs it.
import { matchTool } from './catalog.mjs';

const LEAD = String.raw`(?:^|[;&|(]\s*|\bthen\s+|\bdo\s+|&&\s*)\s*(?:\w+=\S*\s+)*`;
// The token ends here: `cat` is a byte-mover, `catalog-tool` is not, and `\b` alone would admit
// `cat-fish`. `env` is a byte-mover only alone (or with flags) — `env VAR=x cmd` runs cmd — and
// `git branch` only when every argument is a flag: `git branch -d x` and `git branch x` do work.
const END = String.raw`(?=\s|$|[;&|)])`;
const READ = new RegExp(LEAD + String.raw`(?:` +
  String.raw`(?:cat|grep|rg|sed|awk|head|tail|sort|uniq|cut|tr|wc|jq|find|diff|ls|pwd|echo|printf|less|more|tee|xargs` +
  String.raw`|basename|dirname|realpath|stat|file|which|type|printenv|date|test|true|false` +
  String.raw`|cd|mkdir|rmdir|rm|cp|mv|touch|ln|chmod)` + END +
  String.raw`|env(?:\s+-\S+)*\s*(?:$|[;&|)])` +
  String.raw`|git\s+(?:-C\s+\S+\s+)?(?:log|diff|show|status|blame|ls-files|rev-parse|worktree\s+list)` + END +
  String.raw`|git\s+(?:-C\s+\S+\s+)?branch(?:\s+-\S+)*\s*(?:$|[;&|)])` +
  String.raw`)`);
// A command is a byte-mover only if every segment of it is. Recognised at LEAD like the other
// regexes — but tested per segment, because LEAD matching ANYWHERE would make `cargo build && echo
// done` a read and unwrap the build; the exemption is by kind, and a compound with an output producer
// in it is not of that kind. Pipes are not split here: a `|` was already 'piped' at the step above.
// A trailing separator or newline (`cat a;`, `ls\n`) leaves a whitespace-only segment that names no
// command; it is not counted, or `READ.test('')` fails the `every` and the byte-mover is observed
// (re-review R1). A command with no segment left at all is not a read: `every` over nothing is true.
// A single `&` is a boundary too, as LEAD already says it is (re-review R2: `cargo build & cat x`
// was one segment, and its LEAD-anchored `cat` made the backgrounded build a read) — but not the
// `&` of `&&`, and not the one inside a redirect (`2>&1`, `>&2`), which would leave a `1` segment.
const SEGMENT = /\s*(?:;|&&|\|\||(?<![>&])&(?!&)|\r?\n)\s*/;
const isRead = (command) => {
  const segments = command.split(SEGMENT).filter((s) => s.trim() !== '');
  return segments.length > 0 && segments.every((s) => READ.test(s));
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
// literal. With no catalog the function is exactly what it was: a pure function of the string.
export function classify(command, { catalog } = {}) {
  if (isNever(command)) return 'plain';
  if (PIPED.test(command)) return 'piped';
  // quiet_hook.py:105 — a stderr-merge token cancels the redirect exemption entirely.
  if (command.includes('>') && FILE_REDIRECT.test(command) && !command.includes('2>&1')) return 'redirected';
  if (GH_READ.test(command) || isRead(command)) return 'read';
  if (catalog && matchTool(command, catalog)) return 'plain';
  if (INFRA.test(command)) return 'infra';
  if (NOISY.test(command)) return 'noisy';
  return 'plain';
}
