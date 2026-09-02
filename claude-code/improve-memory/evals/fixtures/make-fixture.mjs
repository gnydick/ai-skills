#!/usr/bin/env node
// make-fixture.mjs — builds a small stand-in for ~/.claude so /improve-memory
// can be exercised without touching the real memory bank.
//
//   node make-fixture.mjs <dest> [--with-overview]
//
// The tree contains two projects with memory directories, their fake
// repositories (so the inventory can resolve cwd and find CLAUDE.md), a dream
// overview with candidates at every confidence level, and — with
// --with-overview — a standing Memory Improvement Overview with some F-items
// already ticked, for testing `apply`.
//
// Planted defects (what a correct pass should find):
//   alpha: cargo-clean-often.md ⊂ run-cargo-clean-frequently.md   (subset duplicate)
//   alpha: one-agent-at-a-time.md vs dream #1 (updates)            (contradiction, user's words)
//   alpha: deploy-after-every-commit.md vs dream #2 (updates)      (reversal, user's words)
//   alpha: MEMORY.md has a dangling entry and misses one file      (index)
//   alpha: build-cache-location.md links [[worktree-hygiene]] that does not exist
//   alpha: a 12 KB CLAUDE.md whose "Mock server" section applies only to packages/mock/
//   beta:  gui-mouse-bindings.md is alpha's file with the project name swapped
//   beta:  no MEMORY.md at all
//   dream: #3 medium, #4 low, #5 global high, one decision, one superseded-only line

import fs from "node:fs";
import path from "node:path";

const dest = process.argv[2];
if (!dest) { console.error("usage: make-fixture.mjs <dest> [--with-overview]"); process.exit(2); }
const withOverview = process.argv.includes("--with-overview");
const root = path.resolve(dest);
const alphaRepo = path.join(root, "repos", "alpha");
const betaRepo = path.join(root, "repos", "beta");

const w = (rel, text) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text.replace(/^\n/, "")); };
const jsonl = (cwd) => JSON.stringify({ type: "user", cwd, sessionId: "fixture", timestamp: "2026-08-30T10:00:00Z", message: { role: "user", content: "hi" } }) + "\n";

fs.rmSync(root, { recursive: true, force: true });

// ---------- alpha project memory ----------
const A = "projects/X--fixture-alpha/memory/";
w("projects/X--fixture-alpha/session-1.jsonl", jsonl(alphaRepo));

w(A + "MEMORY.md", `
# Memory index

## Hard rules
- [One agent at a time](one-agent-at-a-time.md) — Gabe 2026-08-24: one subagent, serialized; never two at once
- [Deploy after every commit](deploy-after-every-commit.md) — ship as you go; he checks on the real printer
- [Cargo clean often](cargo-clean-often.md) — disk fills up; clean after build-heavy work
- [Run cargo clean frequently](run-cargo-clean-frequently.md) — HARD RULE; not while a background agent builds

## Environment
- [Build cache location](build-cache-location.md) — CARGO_TARGET_DIR shared across worktrees; use target-iso
- [Old windows ninja notes](windows-ninja-build.md) — vcvars first, Release deps only
`);

w(A + "one-agent-at-a-time.md", `
---
name: one-agent-at-a-time
description: Gabe 2026-08-24 — ONE subagent at a time, serialized; never two at once
metadata:
  type: feedback
---

Gabe, 2026-08-24, mid-turn: **"no parallel agents"**. Dispatch one subagent,
wait for its completion, then dispatch the next. Never two at once.

**Why:** three top-level agents were running and one fanned out five of its
own; the audit agent burned ~96k tokens and returned nothing usable.

**How to apply:** one Agent call, then wait. Every dispatch prompt forbids the
subagent from spawning its own agents. Related: [[build-cache-location]].
`);

w(A + "deploy-after-every-commit.md", `
---
name: deploy-after-every-commit
description: "Gabe wants a deploy after every major commit, not batched at the end of a session"
metadata:
  type: feedback
  originSessionId: b919dbc5-0000-0000-0000-000000000001
  modified: 2026-07-31T00:58:29.186Z
---

Deploy after every major commit. Do not batch several fixes and ship once at
the end — Gabe said so directly on 2026-07-30 after commits had piled up.

**Why:** he verifies on the real printer, not in the dev server.

**How to apply:** tests green → commit → build and ship → report the hash.
`);

w(A + "cargo-clean-often.md", `
---
name: cargo-clean-often
description: "Run cargo clean often; the dev disk fills up from Rust target dirs"
metadata:
  type: feedback
  originSessionId: 768bc8ad-0000-0000-0000-000000000002
---

Run \`cargo clean\` often — the dev disk fills up from huge Rust \`target/\` dirs.

**Why:** a full disk breaks builds.

**How to apply:** after a build-heavy task, clean the repo's \`target/\`.
`);

w(A + "run-cargo-clean-frequently.md", `
---
name: run-cargo-clean-frequently
description: "HARD RULE — run cargo clean frequently; never while a background agent is building in the same repo"
metadata:
  type: feedback
  originSessionId: 768bc8ad-0000-0000-0000-000000000002
---

**HARD RULE (user):** run \`cargo clean\` **frequently** — the dev disk fills
up. Rust \`target/\` dirs are huge (lane worktrees once hit ~230 GB).

**Why:** disk pressure on the dev box; a full disk breaks builds and every
other tool.

**How to apply:**
- After a build-heavy task completes, \`cargo clean\` the repo's \`target/\`.
- Also clean stray \`target/\` dirs under \`.claude/worktrees/*\`.
- CAUTION: do NOT clean the main \`target/\` while a BACKGROUND AGENT is
  building in the same repo — it deletes the dir the agent is compiling into.
- Prefer \`cargo clean -p <crate>\` when only one crate is stale.
Related: [[build-cache-location]].
`);

w(A + "build-cache-location.md", `
---
name: build-cache-location
description: "CARGO_TARGET_DIR is shared across worktrees and can be poisoned; use target-iso for isolation"
metadata:
  type: project
---

\`CARGO_TARGET_DIR\` is shared across all worktrees of this repo, so a broken
build in one worktree poisons the cache for the others.

**Why:** cost an afternoon on 2026-08-20 chasing a phantom compile error.

**How to apply:** for isolation use the \`target-iso\` profile; never whole-dir
clean while another worktree builds. See [[worktree-hygiene]] and
[[run-cargo-clean-frequently]].
`);

w(A + "windows-ninja-build.md", `
---
name: windows-ninja-build
description: "Windows Ninja build: run vcvars first; deps always Release; app RelWithDebInfo"
metadata:
  type: project
---

Build deps first, always Release on Ninja; the app must be RelWithDebInfo,
not Debug. Needs vcvars plus DEP_BUILD_DIR set.
`);

w(A + "gui-mouse-bindings.md", `
---
name: gui-mouse-bindings
description: "Alpha GUI viewport mouse bindings — don't copy CrealityPrint"
metadata:
  type: feedback
  originSessionId: 08a2b596-0000-0000-0000-000000000003
---

Alpha GUI viewport mouse bindings (updated 2026-06-18). Do NOT change them to
match CrealityPrint.

- Left-drag on empty space = orbit.
- Left-drag starting on the model = grab and manipulate.
- Right-drag = nothing (explicitly disabled).
- Middle-drag = pan. Scroll = zoom.

**Why:** CrealityPrint moves the model with the right button, which the user
finds unintuitive.

**How to apply:** implemented in \`crates/alpha-ui/src/app.rs\`.
`);

// ---------- beta project memory ----------
const B = "projects/X--fixture-beta/memory/";
w("projects/X--fixture-beta/session-1.jsonl", jsonl(betaRepo));

w(B + "gui-mouse-bindings.md", `
---
name: gui-mouse-bindings
description: "Beta GUI viewport mouse bindings — don't copy CrealityPrint"
metadata:
  type: feedback
  originSessionId: 08a2b596-0000-0000-0000-000000000003
---

Beta GUI viewport mouse bindings (updated 2026-06-18). Do NOT change them to
match CrealityPrint.

- Left-drag on empty space = orbit.
- Left-drag starting on the model = grab and manipulate.
- Right-drag = nothing (explicitly disabled).
- Middle-drag = pan. Scroll = zoom.

**Why:** CrealityPrint moves the model with the right button, which the user
finds unintuitive.

**How to apply:** implemented in \`crates/beta-ui/src/app.rs\`.
`);

w(B + "user-terse-rust-expert.md", `
---
name: user-terse-rust-expert
description: "User is fluent in Rust and Windows shell internals; terse; wants action over surveys"
metadata:
  type: user
---

Fluent in Windows shell internals and Rust. Terse. Wants action over surveys
of options.
`);

// ---------- fake repositories ----------
const rulesArchive = (name, body) => w(`repos/alpha/docs/rules/${name}.md`, body);
rulesArchive("be-straightforward", `
# Be straightforward

Gabe, 2026-08-14. Full text of the rule with the incident that produced it:
three attribution collapses in one session, a gap-fill defect mislabeled as
an improvement.
`);

w("repos/alpha/CLAUDE.md", `
# CLAUDE.md

## Be straightforward (HARD RULE)

Gabe 2026-08-14. Outranks looking competent.

- "I don't know" said the moment it is true.
- Every claim carries status: measured (command and output) or believed.
- Attribution only after isolation.
- Deviations announced BEFORE they happen.

Full rule: docs/rules/be-straightforward.md

## Tests

Every bug fix, feature, function, class and method ships with a unit test, a
fixture generator, and coverage in every related integration test.

## Agents

Gabe 2026-08-24: no parallel agents. One subagent at a time, serialized. Wait
for it to finish before dispatching the next. This was ruled after three
top-level agents were running and one of them silently fanned out five
sub-agents of its own, eight live agents in total; the audit agent burned
about 96k subagent tokens and returned nothing usable before being killed.
Parallel agents also collide on the same files: the reason the writer had to
be kept and the readers killed was that it was mid-edit inside
scripts/merge-gate.sh, and interrupting it would have left the gate
half-refactored. ListAgents is how you verify what is live; TaskList shows
the todo list, not running agents, and answered "No tasks found" while eight
agents were running. If work must be interrupted, kill readers first and let
writers finish.

## Deploys

Deploy after every major commit. Do not batch several fixes and ship once at
the end of a session, and do not leave main ahead of the board while asking
whether to deploy. Gabe said so directly on 2026-07-30 after several commits
had piled up undeployed. He verifies on the real printer, not in the dev
server; a commit he cannot see on the board is a commit he cannot confirm or
reject. Finish a coherent unit of work, tests plus tsc -b --force plus pnpm
build green, commit, build with the base and ship, report the commit and hash
stamp so he can check the footer matches. "Major" means a user-visible fix or
feature; a docs-only or test-only commit does not need its own deploy.

## Mock server

The full mock suite runs during development, and a user-facing change is not
done until it has been exercised against it. Keep pnpm mock up while building
UI so any change can be clicked through without waiting for a deploy to the
printer. A green unit suite is not UAT. Two defects reached the real printer in
one day with 1,500 tests passing, because nothing ran the boot path end to
end. The mock moves with every iteration: a change to what the UI reads from
or writes to the board updates packages/mock in the SAME change, not later.
The machine-identity campaign keyed everything off boards[].uniqueId and never
touched the mock, which still served a machine with no boards at all; the
drift was found by the owner failing to use it. Whoever stands a mock up owns
tearing it down: on 2026-08-29 ten orphaned mock processes were still
listening, the oldest two days old, on ports 8136, 8138, 8142 and 8144, the
four branches merged the day before. Identify the mock you are driving by PID
and start time, never by "something answered on that port": on 2026-08-29 a
start command failed outright while curl on 8971 still returned a healthy
response from the previous evening's orphan. Falsifying check:
Get-CimInstance Win32_Process filtered to mock returns no process older than
the current session. Confirm a kill by port state, never by exit code; pkill
exits 0 on Windows while leaving the process alive.

## Build cache

CARGO_TARGET_DIR is shared across worktrees. Use the target-iso profile for
isolation. Never whole-dir clean while another worktree is building. Run cargo
clean frequently because the dev disk fills up; lane worktrees once reached
230 GB of target directories. Do not clean while a background agent is
building in the same repo. Prefer cargo clean -p <crate> when one crate is
stale.

## Windows

Bash heredocs fail on large bodies (ENAMETOOLONG), apostrophes, backslashes
and unicode; one unparsed heredoc created a GitHub issue with an empty body.
Write scripts and long files with the Write tool and run the file. python3 is
not on PATH, use python. jq is not installed. gh api needs -F for integers and
returns exit 0 on API failures. Piping a gate through tail returns tail's exit
code.
`);
w("repos/alpha/packages/mock/README.md", "# mock\n");
w("repos/alpha/packages/ui/README.md", "# ui\n");
w("repos/alpha/scripts/merge-gate.sh", "#!/bin/sh\n");
w("repos/alpha/crates/alpha-ui/src/app.rs", "fn main() {}\n");

w("repos/beta/CLAUDE.md", `
# Beta

Personal fork of alpha's slicer GUI. Correctness over approximation: true
algorithms, not approximations; separate engine-output changes from
preview-only changes.
`);
w("repos/beta/crates/beta-ui/src/app.rs", "fn main() {}\n");

// ---------- user-level ----------
w("rules/context7.md", "Use Context7 MCP to fetch current documentation whenever the user asks about a library.\n");

// ---------- dream ----------
w("session-analysis/state.json", JSON.stringify({ runs: { dream: { lastRunAt: "2026-08-31T20:07:04.913Z" } } }, null, 2) + "\n");
const dream = `
---
skill: session-analysis
subcommand: dream
run_at: 2026-08-31T12:57:00-07:00
window: 2026-08-18 → 2026-08-31
sessions: 12
projects: 2
candidates: 5
existing_memories_checked: 9
---

# Dream — 2026-08-18 → 2026-08-31, 12 sessions across 2 projects

Two projects, alpha (7 memories) and beta (2 memories). Every candidate below was checked against the existing-memories list.

## Feedback (rules and corrections)
1. **agent-classes-serial-within-parallel-across** [feedback · alpha · high · updates one-agent-at-a-time]
   Agents come in classes — effort, review, test, rule-intake — and each class runs strictly one at a time, but different classes may run concurrently; never more than one agent in the same worktree unless Gabe asks; agents are named \`<class>: <subject>\`.
   _Why:_ The saved memory forbids all parallelism and would over-serialize.
   _Seen:_ Worktree GIT_562 (2026-08-26), "RULE: there are rules about running agents for different classes of tasks. each can only run serially. parallel execution is allowed between the classes e.g. effort, review, rule-intake"

2. **printer-deploy-only-after-gabe-uats-mock** [feedback · alpha · high · updates deploy-after-every-commit]
   Every code-complete iteration is stood up on the mock for Gabe to drive, but nothing ships to the printer until he says so; a clean review does not count as that word.
   _Why:_ The saved memory says deploy after every major commit; Gabe was upset at an assumed deploy and two defects reached his printer.
   _Seen:_ GIT_86 machine-identity phase-1 (2026-08-26), "deploy to mock? we don't deploy without me UATing mock" / "why did you deploy to printer, I haven't uat'd"

3. **no-env-var-toggles-branch-is-the-switch** [feedback · alpha · medium · new]
   Never gate experimental behaviour behind an environment variable — a purpose branch or worktree is the switch.
   _Why:_ Claude reached for an env-var A/B gate and was corrected.
   _Seen:_ Extract and organize design rules (2026-08-20), "stop with the envvar stuff"

## User
4. **prefers-worked-numeric-examples** [user · alpha · low · new]
   Explanations of geometry should carry a worked numeric example rather than terminology.
   _Why:_ Inferred from two sessions where an example unblocked the discussion.
   _Seen:_ Rounding (2026-08-26), assistant narration: "the numeric example landed where the definition had not"

## Project
(X--fixture-alpha memory dir: \`${path.join(root, A)}\`; global candidates belong in every project's memory or in the user-level CLAUDE.md)

5. **windows-shell-gotchas-use-write-tool** [project · global · high · new]
   On this Windows box Bash heredocs fail on large bodies, apostrophes, backslashes and unicode; write scripts and long files with the Write tool and run the file; \`python3\` is not on PATH; \`jq\` is not installed.
   _Why:_ The heredoc failure recurred in twelve turns across nine sessions in both projects.
   _Seen:_ Arachne path merging logic, beta (2026-08-19), "The shell choked on the heredoc size (ENAMETOOLONG)"; ferris, alpha (2026-08-29), "That failed badly and left damage"

## Superseded or contradicted
- **one-agent-at-a-time** (alpha) — stricter than the current class-based rule; replaced by #1.
- **deploy-after-every-commit** (alpha) — reversed by #2: mock every iteration, printer only on Gabe's word.
- **windows-ninja-build** (alpha) — the project no longer builds with Ninja; Gabe said on 2026-08-28 "we moved everything to cargo, drop the ninja notes".

## Needs a decision
- **Rule replication to worktrees.** GIT_562 (2026-08-31): Gabe ruled "rules filed in main need to be replicated to all worktrees", then asked "so we don't need rule changes to be propagated to worktrees?" after learning agents may read machinery from root. Whether replication is still required is open.

## Also seen, weaker
- github-issue-images-upload-as-attachments (alpha, high): upload via the browser session, never commit PNGs.
- always-write-local-tools-for-analysis (global, high): analysis work is a reusable script in scripts/ or tools/.
`;
w("session-analysis/dream/2026-08-31-1257.md", dream);
w("session-analysis/dream/latest.md", dream);

// ---------- optional standing overview for `apply` ----------
if (withOverview) {
  const memDir = path.join(root, A);
  const alphaClaude = path.join(alphaRepo, "CLAUDE.md");
  const { createHash } = await import("node:crypto");
  const sha = createHash("sha256").update(fs.readFileSync(alphaClaude)).digest("hex");
  w("improve-memory/state.json", JSON.stringify({ runs: 1, lastRunAt: "2026-08-31T21:00:00-07:00", lastDreamConsumed: path.join(root, "session-analysis/dream/2026-08-31-1257.md") }, null, 2) + "\n");
  w("improve-memory/proposals/X--fixture-alpha/CLAUDE.md", `
# CLAUDE.md

## Be straightforward (HARD RULE)

Gabe 2026-08-14. Outranks looking competent.

- "I don't know" said the moment it is true.
- Every claim carries status: measured or believed.
- Attribution only after isolation.
- Deviations announced BEFORE they happen.

Full rule: docs/rules/be-straightforward.md

## Tests

Every change ships with a unit test, a fixture generator, and coverage in
every related integration test.

## Agents

- Four classes: effort, review, test, rule-intake. Serial within a class,
  concurrent across classes. One agent per worktree unless Gabe asks.
- Name agents \`<class>: <subject>\` at spawn.

Full rule and the 2026-08-24 incident: docs/rules/agents.md

## Deploys

- Every code-complete iteration goes to the mock for Gabe to drive.
- Nothing ships to the printer until he says so. A clean review is not that word.

Full rule: docs/rules/deploys.md

## Build cache

- CARGO_TARGET_DIR is shared across worktrees; use target-iso for isolation.
- cargo clean frequently, never while a background agent builds here.

## Windows

Bash heredocs fail on large bodies and unicode; write files with the Write
tool. python3 is not on PATH; jq is not installed. Full list: docs/rules/windows.md
`);
  w("improve-memory/proposals/X--fixture-alpha/.claude/rules/mock.md", `
---
paths:
  - "packages/mock/**"
---

# Mock server

- A user-facing change is not done until exercised against the mock.
- The mock moves with every iteration: board-facing changes update packages/mock in the same change.
- Whoever stands a mock up tears it down; identify it by PID and start time; confirm a kill by port state.

Incidents and the falsifying check: docs/rules/mock.md
`);
  w("improve-memory/proposals/X--fixture-alpha/FIDELITY.md", `
| # | original | disposition |
|---|---|---|
| 1 | Be straightforward | kept |
| 2 | Tests | condensed: "bug fix, feature, function, class and method" → "change" |
| 3 | Agents | condensed; incident → docs/rules/agents.md; rule updated from dream #1 |
| 4 | Deploys | condensed; rule updated from dream #2; old rule → docs/rules/deploys.md as superseded |
| 5 | Mock server | moved → .claude/rules/mock.md (paths packages/mock/**); incidents → docs/rules/mock.md |
| 6 | Build cache | condensed; 230 GB figure → docs/rules/windows.md |
| 7 | Windows | condensed; gh/tail gotchas → docs/rules/windows.md |
`);
  // Archive files carry the old CLAUDE.md sections verbatim, as a real proposal would.
  const oldClaude = fs.readFileSync(alphaClaude, "utf8");
  const section = (title) => { const m = oldClaude.match(new RegExp(`^## ${title}\\n\\n([\\s\\S]*?)(?=^## |\\Z)`, "m")); return m ? m[1].trim() : ""; };
  w("improve-memory/proposals/X--fixture-alpha/docs/rules/agents.md", `# Agents\n\nRule in force: four classes, serial within a class, concurrent across (Gabe 2026-08-26).\n\n## Superseded 2026-08-24 ruling and incident, verbatim\n\n${section("Agents")}\n`);
  w("improve-memory/proposals/X--fixture-alpha/docs/rules/deploys.md", `# Deploys\n\nRule in force: mock every iteration, printer only on Gabe's word (2026-08-26).\n\n## Superseded 2026-07-30 rule, verbatim\n\n${section("Deploys")}\n`);
  w("improve-memory/proposals/X--fixture-alpha/docs/rules/mock.md", `# Mock server\n\n${section("Mock server")}\n`);
  w("improve-memory/proposals/X--fixture-alpha/docs/rules/windows.md", `# Windows\n\n${section("Windows")}\n\n## Build cache figures\n\n${section("Build cache")}\n`);

  // Run 1's "Applied" section must match disk: apply those changes to the memory bank here.
  fs.rmSync(path.join(memDir, "cargo-clean-often.md"));
  w(A + "one-agent-at-a-time.md", `
---
name: one-agent-at-a-time
description: "Gabe 2026-08-26 — agent classes (effort, review, test, rule-intake) run serially within a class, concurrently across classes; one agent per worktree"
metadata:
  type: feedback
  promotedFrom: session-analysis dream 2026-08-31T12:57:00-07:00
---

Gabe, 2026-08-26: **"RULE: there are rules about running agents for different
classes of tasks. each can only run serially. parallel execution is allowed
between the classes e.g. effort, review, rule-intake"**. Never more than one
agent in the same worktree unless Gabe asks. Agents are named
\`<class>: <subject>\`.

**Why:** the blanket ban below over-serialized; the class rule keeps the
collision protection.

**How to apply:** check ListAgents for a live agent of the same class before
dispatching; different classes may run side by side. Related:
[[build-cache-location]].

**Superseded 2026-08-26.** Gabe, 2026-08-24, mid-turn: **"no parallel
agents"** — one subagent, wait, then the next. Ruled after three top-level
agents were running and one fanned out five of its own; the audit agent
burned ~96k tokens and returned nothing usable.
`);
  w(A + "deploy-after-every-commit.md", `
---
name: deploy-after-every-commit
description: "Gabe 2026-08-26 — every code-complete iteration goes to the mock for his UAT; nothing ships to the printer until he says so"
metadata:
  type: feedback
  originSessionId: b919dbc5-0000-0000-0000-000000000001
  promotedFrom: session-analysis dream 2026-08-31T12:57:00-07:00
---

Gabe, 2026-08-26: **"deploy to mock? we don't deploy without me UATing mock"**
/ **"why did you deploy to printer, I haven't uat'd"**. Every code-complete
iteration is stood up on the mock for Gabe to drive; nothing ships to the
printer until he says so. A clean review is not that word.

**Why:** two defects reached his printer the day the rule was written.

**How to apply:** tests green → commit → stand up on the mock → tell him it is
ready → wait for his word → ship and report the hash.

**Superseded 2026-08-26.** Gabe, 2026-07-30: deploy after every major commit,
never batch, because he verifies on the real printer, not in the dev server.
`);
  w(A + "build-cache-location.md", fs.readFileSync(path.join(memDir, "build-cache-location.md"), "utf8").replace("[[worktree-hygiene]]", "worktree-hygiene"));
  w(A + "MEMORY.md", `
# Memory index

## Hard rules
- [One agent at a time](one-agent-at-a-time.md) — Gabe 2026-08-26: agent classes serial within, concurrent across; one per worktree
- [Deploy after every commit](deploy-after-every-commit.md) — Gabe 2026-08-26: mock every iteration; printer only on his word
- [Run cargo clean frequently](run-cargo-clean-frequently.md) — HARD RULE; not while a background agent builds

## Environment
- [Build cache location](build-cache-location.md) — CARGO_TARGET_DIR shared across worktrees; use target-iso
- [Old windows ninja notes](windows-ninja-build.md) — vcvars first, Release deps only

## GUI
- [GUI mouse bindings](gui-mouse-bindings.md) — left orbit / left-on-model grab; right does nothing; don't copy CrealityPrint
`);

  w("improve-memory/Memory Improvement Overview.md", `
---
skill: improve-memory
run: 1
run_at: 2026-08-31T21:00:00-07:00
dream_consumed: ${path.join(root, "session-analysis/dream/2026-08-31-1257.md")}
dream_run_at: 2026-08-31T12:57:00-07:00
projects_in_scope: 2
memories_read: 9
applied: 4
flagged: 4
carried_forward: 0
---

# Memory Improvement Overview — run 1, 2026-08-31

Read the dream of 2026-08-31 (5 candidates) against 9 memories in 2 projects. Applied the two high-confidence reversals, one merge and the index fixes; four items need you.

## Applied

### X--fixture-alpha (\`${memDir}\`)
- **Superseded** \`one-agent-at-a-time.md\` in place by dream #1 (Gabe 2026-08-26) — classes serial within, concurrent across; old ruling folded into a dated Superseded paragraph, file name kept.
- **Superseded** \`deploy-after-every-commit.md\` in place by dream #2 (Gabe 2026-08-26) — mock every iteration, printer on his word; old rule folded in, file name kept.
- **Merged** \`cargo-clean-often.md\` into \`run-cargo-clean-frequently.md\` — subset. 0 links repointed, loser deleted.
- **Fixed** 1 broken link in \`build-cache-location.md\` (\`[[worktree-hygiene]]\` unbracketed).
- **Index:** removed the merged line, added the missing \`gui-mouse-bindings.md\` line, rewrote two hooks.

## Needs your approval

### Decisions

- [ ] **F1** · alpha · decision · since run 1
  Rule replication to worktrees: Gabe ruled "rules filed in main need to be replicated to all worktrees" (2026-08-31), then asked "so we don't need rule changes to be propagated to worktrees?" after learning agents read machinery from root.
  \`\`\`action
  kind: choose
  options:
    a: write ${path.join(memDir, "rules-replicate-to-worktrees.md")} saying replication is required
    b: write ${path.join(memDir, "rules-live-in-main-only.md")} saying agents read root, no replication
  \`\`\`

### Promotions (medium / low confidence)

- [x] **F2** · alpha · promote · medium · since run 1
  Never gate experimental behaviour behind an env var; the branch is the switch. _Seen:_ (2026-08-20) "stop with the envvar stuff".
  \`\`\`action
  kind: write
  path: ${path.join(memDir, "no-env-var-toggles-branch-is-the-switch.md")}
  index_line: "- [No env-var toggles](no-env-var-toggles-branch-is-the-switch.md) — the purpose branch is the switch; never an env var"
  content: |
    ---
    name: no-env-var-toggles-branch-is-the-switch
    description: "Never gate experimental behaviour behind an env var; a purpose branch or worktree is the switch"
    metadata:
      type: feedback
      promotedFrom: session-analysis dream 2026-08-31T12:57:00-07:00
    ---

    Never gate experimental behaviour behind an environment variable. A purpose
    branch or worktree is the switch: the experiment runs unconditionally there
    and main is the comparison. Gabe, 2026-08-20: "stop with the envvar stuff".

    **Why:** env vars are unusable on the tablet and violate environment-read-once.

    **How to apply:** put an experiment in its own worktree; delete the worktree
    when the experiment is rejected.
  \`\`\`

- [ ] **F3** · alpha · promote · low · since run 1
  Prefers worked numeric examples over terminology. Inferred from assistant narration only; would rise if Gabe says so.
  \`\`\`action
  kind: write
  path: ${path.join(memDir, "prefers-worked-numeric-examples.md")}
  index_line: "- [Worked numeric examples](prefers-worked-numeric-examples.md) — explain geometry with a number, not a term"
  content: |
    ---
    name: prefers-worked-numeric-examples
    description: "Explain geometry with a worked numeric example rather than terminology"
    metadata:
      type: user
      promotedFrom: session-analysis dream 2026-08-31T12:57:00-07:00
    ---

    Explanations of geometry land better with a worked numeric example.
  \`\`\`

### Instruction-file proposals

- [x] **F4** · alpha · proposal · since run 1
  \`CLAUDE.md\` 4,870 → 1,410 chars; new: \`.claude/rules/mock.md\` (430 chars), \`docs/rules/{agents,deploys,mock,windows}.md\`.
  Ledger: ${path.join(root, "improve-memory/proposals/X--fixture-alpha/FIDELITY.md")} — 1 kept, 5 condensed, 1 moved, 0 dropped.
  \`\`\`action
  kind: swap
  files:
    - target: ${alphaClaude}
      proposal: ${path.join(root, "improve-memory/proposals/X--fixture-alpha/CLAUDE.md")}
      target_sha256: ${sha}
    - target: ${path.join(alphaRepo, ".claude/rules/mock.md")}
      proposal: ${path.join(root, "improve-memory/proposals/X--fixture-alpha/.claude/rules/mock.md")}
      target_sha256: new
    - target: ${path.join(alphaRepo, "docs/rules/agents.md")}
      proposal: ${path.join(root, "improve-memory/proposals/X--fixture-alpha/docs/rules/agents.md")}
      target_sha256: new
    - target: ${path.join(alphaRepo, "docs/rules/deploys.md")}
      proposal: ${path.join(root, "improve-memory/proposals/X--fixture-alpha/docs/rules/deploys.md")}
      target_sha256: new
    - target: ${path.join(alphaRepo, "docs/rules/mock.md")}
      proposal: ${path.join(root, "improve-memory/proposals/X--fixture-alpha/docs/rules/mock.md")}
      target_sha256: new
    - target: ${path.join(alphaRepo, "docs/rules/windows.md")}
      proposal: ${path.join(root, "improve-memory/proposals/X--fixture-alpha/docs/rules/windows.md")}
      target_sha256: new
  \`\`\`

## Not acted on
- 2 "also seen" candidates left for a later dream.
`);
}

console.log(`fixture written to ${root}${withOverview ? " (with standing overview; F2 and F4 ticked)" : ""}`);
