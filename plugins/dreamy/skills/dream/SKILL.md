---
name: dream
description: The one-command memory maintenance loop for Claude Code — runs session-analysis dream, improve-memory and send-results back to back, unattended, with a run log so each pass knows which Memory Improvement Overview was last written and which approved items are already applied. Before it analyzes anything it checks whether the user reviewed the last overview (ticked boxes or edited it) and applies the approved items first; if not, it runs the analysis again and writes a fresh overview from whatever changed since. `--mode apply-fixes` only applies what was ticked and reports. Use this whenever the user runs /dream, schedules or loops a memory maintenance pass ("/loop 4h /dream", a nightly routine), says "dream", "run the memory loop", "consolidate my memory and email me", "apply what I approved", "apply the fixes I ticked", or wants the three memory skills run together instead of one at a time — even without naming this skill. Not for running just one of the three; call that skill directly.
---

# dream

Three skills already exist and each finishes on its own: `session-analysis
dream` reads the sessions and proposes, `improve-memory` decides and writes
the Memory Improvement Overview, `send-results` emails the file. What none of
them holds is the state *between* runs — whether the user got to the last
overview, and what has already been applied — so a loop that just called them
in order would either re-propose what was approved or apply it twice. This
skill is that state plus the sequencing.

```
/dream [--mode full|apply-fixes] [--home <dir>]
```

- `--mode full` (default): apply what the user approved, then analyze new
  sessions, then improve memory from the result, then email the overview.
- `--mode apply-fixes`: only apply what the user ticked, then email. No
  analysis, no new overview.
- `--home` replaces `~/.claude` so the skill can be tested against a fixture
  tree (see "Testing"). Never pass it in real use.

Any other argument is not an option: reply with the usage block above and
stop. Do not pass `--since` or `--project` through to the analysis — a
partial pass does not advance the analysis watermark, which would leave the
run log and the analysis disagreeing about what "since last time" means.

## This skill runs unattended

It exists for `/loop`, a scheduled routine, or a habit at the end of the day.
Never ask a question, never wait for approval, never offer choices. Every
decision is made by the run-log script or by the rubric inside the skill
being called, and everything the user needs lands in the overview file and
one email. The chat reply is a status of a few lines.

The three skills each end with their own status line and an instruction to
"reply with nothing else". Inside this skill those lines are intermediate
results: note each one, because the run log and the email summary are built
from them, and give the final reply from the "Status line" section below.

Files:

```
~/.claude/dream/
├── run-log.json   every run: mode, the overview it left (path, sha256, history copy),
│                  the dream file, which F-items were applied, the email id, the review page URL
├── pending.json   written by `status` at the start of a run, consumed by `record`
└── review.html    the last rendered review page (what was published)
```

## Step 0: Pull in ticks from the review page, then establish the facts

The overview file is the source of truth, but the user usually ticks on the
review page (Step 5), a private claude.ai page that saves ticks into itself.
So before reading the file, bring the page's ticks into it. If the run log
has a `pageUrl` (the `status` output shows it; on the very first run there is
none, skip to the status command):

1. Read the page with the Artifact tool, `action: "read"`, `url: <pageUrl>`.
   The page is large, so the tool saves it to a local file and names the
   path; pass that path to the sync:
   ```sh
   node "<skill-dir>/scripts/review.mjs" sync [--home <dir>] --page "<saved html path>"
   ```
   It sets `[x]` on every open item the page has ticked and prints which.
   It never unticks: a tick made in the file directly stays, so a stale page
   cannot withdraw an approval.
2. Then establish the facts:

```sh
node "<skill-dir>/scripts/runlog.mjs" status --mode <mode> [--home <dir>]
```

`<skill-dir>` is the directory containing this SKILL.md. The script reads
the standing overview, the run log, and both upstream skills' state files,
and prints JSON. The fields that drive the run:

- `reviewedBecause` — `ticked` (the user ticked at least one open box that is
  not yet recorded as applied), `edited` (the file's hash differs from what
  the last run recorded, but nothing is ticked), `unchanged`, `no-overview`,
  or `never-recorded` (an overview exists but this skill has never logged a
  run — the first pass after installing).
- `tickedKeys` — the items to apply, as `F<n>@run<N>`. The run number is the
  improve-memory run the item first appeared in; improve-memory carries
  unticked items forward under their original ID, so the ID alone is not
  unique across overviews.
- `declinedKeys` — items the user marked `[-]` ("no"). They go through the
  same apply step, which files them under "Declined" instead of executing
  them. An untouched box means "not yet" and is carried forward.
- `dream.consumedByImproveMemory` — whether the dream file on disk has been
  consumed. `false` means improve-memory has work waiting even if the
  analysis finds no new sessions.
- `steps` — the sequence for this mode, each with the reason. Follow it.

"Reviewed" is decided by evidence the user left in the file, not by time
elapsed. `edited` counts as reviewed but has nothing to apply, so it and
`unchanged` both go straight to the analysis: improve-memory carries unticked
items forward, so the new overview is "what changed since" plus what is
still waiting — exactly the file the user asked for when they have not
looked yet.

## Step 1: Apply what was approved (when `tickedKeys` or `declinedKeys` is not empty)

Invoke the improve-memory skill with the argument `apply` (plus `--home <dir>`
when given). It executes every ticked item and moves each into the
overview's "Applied" section; an item whose target file changed since it
was proposed stays flagged with a note, and that is correct — do not force it.
It also files every `[-]` item under "Declined" so it is never re-proposed;
a decline writes nothing, which is why it still counts as something to do.

Note its status line ("Applied k of n ticked items; s skipped …").

Skill names: invoke the other skills under the same prefix this one was
loaded with — `dreamy:improve-memory` when this skill is
`dreamy:dream`, bare `improve-memory` when installed personally. The Skill
tool accepts whichever is present.

## Step 2: Analyze (`--mode full` only)

Invoke the session-analysis skill with the argument `dream`. It reads the
sessions since its last run and either writes a new
`~/.claude/session-analysis/dream/<stamp>.md` or reports that there were
no new sessions and writes nothing. Both are fine; note which.

It fans out to subagents when the digest is large. Let it — this is the slow
step and it has its own rules for that.

With `--home` there is no analysis to run (session-analysis reads the real
transcripts and has no fixture mode); treat the dream file already in
`<home>/session-analysis/dream/` as this run's analysis and go on.

## Step 3: Improve memory (`--mode full` only)

Run when Step 2 wrote a new dream file, or when Step 0 said
`dream.consumedByImproveMemory` is false. Invoke the improve-memory skill with
no subcommand (plus `--home <dir>` when given). It consumes the latest dream,
edits the memory bank where the evidence allows, and rewrites the standing
overview with the applied changes, the new flagged items, and the still-open
ones carried forward.

When neither condition holds there is nothing for it to consume; skip it
rather than run a pass that rewrites the overview without new input. If Step
1 applied items, the overview already reflects that.

## Step 4: Record the run

```sh
node "<skill-dir>/scripts/runlog.mjs" record --mode <mode> [--home <dir>] [--sent <message id>]
```

Run this after the files are final and before the email, so a failed send
cannot leave a run unrecorded — or run it once more with `--sent` after the
email goes out, to store the message id. The script diffs the ticked items it
snapshotted at Step 0 against the overview now: those no longer under "Needs
your approval" are recorded as applied; those still there are recorded as
`appliedButTargetMoved`. It also stores the overview's new hash — which is
what lets the next run tell an edit from an untouched file — and the dream
file this run left behind.

Skip this step only when the run did nothing at all (apply-fixes with no
ticked items; full mode with no new sessions, a consumed dream, and nothing
ticked). A no-op run has nothing to log, and logging it would make the hash
comparison meaningless.

## Step 5: Publish the review page and report

When the run applied, analyzed or improved anything, first turn the final
overview into the review page:

```sh
node "<skill-dir>/scripts/review.mjs" render [--home <dir>]
```

It writes `~/.claude/dream/review.html`: every open item as a real checkbox
with the change under it, the applied sections folded, the notes at the end.
Publish it with the Artifact tool: `file_path` the rendered page,
`capabilities: {artifact: {}}` (the page saves ticks by republishing itself),
and `url: <pageUrl>` from the run log when there is one so the link stays
stable run after run; on the first publish pass a `favicon` (🌙) and a
one-line `description`. The page is private to the user's account. Then
store the URL:

```sh
node "<skill-dir>/scripts/runlog.mjs" record [--home <dir>] --page "<artifact url>"
```

Then report by invoking the send-results skill with
`"<overview path>" --from dream -- <summary>`. The file is always the Memory
Improvement Overview, because that is the file the user acts on, and the
summary ends with `Review page: <url>` so the phone has a form to tick. Do
not email the user directly; send-results owns the format and the label so
every automation's report lands in the same place. If send-results reports
that Gmail is not connected, say so in the final message and leave both the
file path and the page URL there instead. If the Artifact tool is not
available in this session, skip the page, say so in the summary, and the
file's `[ ]` boxes remain the way to approve.

The summary is two or three sentences the user reads on a phone to decide
whether to open the page now. Build it from the status lines noted above,
in this order, dropping any clause that does not apply:

> Applied `<k>` approved items (`<s>` held back, target changed). Analyzed
> `<N>` sessions across `<M>` projects, `<window>`: `<c>` candidates.
> Memory pass applied `<a>` changes and flagged `<f>` for you (`<d>`
> decisions, `<p>` instruction-file proposals), `<c>` carried forward.
> Review page: `<url>`

A run that changed nothing sends nothing. The user asked for one place to
look, not for a heartbeat.

## Status line

Reply with these lines and nothing else — no overview text, no question:

```
Dream loop done (<mode>): <what ran, e.g. "applied 2 approved items, analyzed 14 sessions, memory pass run" or "nothing new since <date>">.
Overview: ~/.claude/improve-memory/Memory Improvement Overview.md — <f> items need you (<c> carried forward). Review page: <url> | no page (<reason>).
Emailed as <message id> | Not emailed (<reason>).
Run <n> logged in ~/.claude/dream/run-log.json.
```

## Why the ordering is apply → analyze → improve

Applying first means the memory bank the analysis and the memory pass see is
the one the user approved, so a candidate the user just accepted is not
re-proposed as "new" and a saved memory the user just corrected is what the
dream compares against. Recording before sending means a send failure is
visible in the log rather than a mystery on the next run.

## Testing

`improve-memory` ships a fixture generator that builds a stand-in for
`~/.claude` with two projects, a dream file, and — with `--with-overview` —
a standing overview that already has ticked boxes:

```sh
node "<repo>/claude-code/improve-memory/evals/fixtures/make-fixture.mjs" <dir> [--with-overview]
/dream --home <dir>
/dream --mode apply-fixes --home <dir>
```

The run log then lands in `<dir>/dream/`. Only the email step touches
anything outside `<dir>`; when testing, stop before it and say so.

## Files in this skill

- `scripts/runlog.mjs` — `status` (facts, verdict, steps; snapshots the
  ticked items) and `record` (appends the run, diffs applied items, stores
  the overview hash, the message id and the page URL). `--help` prints the
  contract.
- `scripts/review.mjs` — `render` (overview → the review page with real
  checkboxes) and `sync` (ticks from a published page → `[x]` in the
  overview file, additive only). `--help` prints the contract.
- `evals/evals.json` — test prompts against the fixture tree.
