# Corrections to `disposition.csv`

`disposition.csv` is the recalibration's record of what happened to each of the 822 extracted rule
items. The audit in gnydick/ai-skills#110 verified its claims against the shipped text for the first
time and found rows whose recorded disposition is **not true of what shipped**.

The CSV is left byte-for-byte as it was written. Corrections live here so the record still shows
what was claimed on the day, and the next reader — or the next audit — does not re-derive a false
conclusion from it. Each row below was upheld by an adversarial agent that read `STATUS.md` in full,
searched it by concept, read the row's own `decision` column, and searched the enforcing code.

The pattern: **the ledger was written from intent, not from the file.** In three rows the note names
the very clause that did not ship.

| Row | csv line | Recorded claim | What actually shipped |
|---|---|---|---|
| M47 | 48 | `merged` → M46, note **"No licence to deviate"** | the licence-to-deviate prohibition shipped nowhere |
| M107 | 110 | `merged` → M228, note "Rendered-layout check in hands-on verification" | the rendered-layout acceptance criterion shipped nowhere |
| M113 | 114 | note asserts **"switch shape kept"** | "matches its shape to the question being asked" is absent |
| M201 | 202 | `merged` → M173 | `core.md:4` ships every clause of the merged wording except "and what the check could actually see" |
| M229 | 230 | `skill`, note **"positive control via TDD red"** | no positive control shipped; TDD red is not one |
| M247 | 248 | `merged` → M246, note "Same build" | shipped narrowed to performance changes only |
| M267 | 268 | `skill` (i.e. as written) | shipped without its "on the companion entry" destination |
| M518 | 519 | `mechanism` → hosted-CI wizard | the wizard carried no part of the rule; see below |

Every one of these cites a decision that does not authorize what happened. Decision (2) ("one skill
per kind") appears most often and authorizes **relocation**, not the removal of a clause.

## M518 is the different one

The other seven lost prose. M518 lost a mechanism. The pre-reorg `templates/hosted-check.yml` header
carried the owner ruling of 2026-09-02 — *"The hosted check BLOCKS: protect the branch on this job."*
Decision (14) replaced that template with the `--hosted-ci` wizard, and the wizard emitted no such
line. Branch protection is a forge setting nothing in this repository can read or set, so that
sentence **was** the entire mechanism: every project that ran the wizard got a workflow that reports
red and cannot stop a merge, and was never told to make the job required.

It was the only one of the 47 `mechanism` rows whose destination did not carry its rule. Nothing had
ever checked one before, because decision (49) removed the gate's claims mechanism — there is no
check that a `mechanism` row's destination contains what the row says it contains.

## Status

All eight are repaired in the pass tracked by #114. This file is the record that the ledger's own
claims cannot be taken at face value; the 130 `merged` rows have been verified only through their
merge targets, and the 100 `parked` and 66 `dropped` rows have never been re-examined at all.
