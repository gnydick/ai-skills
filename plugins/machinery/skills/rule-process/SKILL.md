---
name: rule-process
description: Load the moment a PRULE:, URULE: or SPEC: prompt is captured (the capture hook says so), when a prompt starts with "N rules pending" or "N specifications pending", when a commit is refused for a pending inbox entry or by a slipbox_check leg, when filing an ADR, a design spec, a plan or a living map, and when the banner says the slip box is NOT MIGRATED. Files or dismisses each pending entry and commits. Replaces rule-intake and spec-intake.
---
# Rules and specifications

- File only what was dictated. A rule you think of yourself is a proposal to the owner.
- An owner ruling given in conversation carries no marker, so nothing captured it and it is not a standing rule. Say that it reads like one and ask the owner to restate it with the marker. Never hand-write a rule into an inbox, `~/.claude/rules/`, or a project's `.claude/rules/`: the prefix triggers own those files, and deciding for yourself that a remark was a rule is the one judgement the marker exists to remove.
- Never edit or delete an inbox entry except its disposition line. A duplicate is dismissed with a note, not removed.
- A URULE is universal for the user: its one home is `~/.claude/rules/universal.md`. It never edits the plugin's `core.md` or a skill — those change only by editing the machinery repo.

## Steps
1. List pending entries: `node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" list`. A project rule or a specification is filed only from the root session (intake refuses otherwise: stop); a universal rule is filed from anywhere.
2. Read each entry's verbatim text and choose its one home:
   - PRULE: a section of a file under `.claude/rules/`.
   - URULE: `~/.claude/rules/universal.md`, as one dated bullet (no section).
   - SPEC (a specification to implement, not a rule or proposal): one note in the slip box, filed by `intake.mjs spec` (§ Filing a SPEC). Find its existing tickets; do not invent any.
   Word a rule as a trigger and an action. Do not repeat it in any other file. Test the section you chose: would that section's remedy have produced this rule's fix? If not, it is the wrong section.
3. Write a project rule: `node "${CLAUDE_PLUGIN_ROOT}/scripts/place.mjs" --file <file> --section "<Heading>" --text "<wording>"`. A specification is written only by `intake.mjs spec`, never with Edit.
4. Commit a project rule and its disposition: `node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" commit --kind project --stamp <stamp> --home "<file> § <Heading>"`. A specification commits itself (§ Filing a SPEC).
5. File a universal rule: `node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" universal --stamp <stamp> --text "<wording>"`. It appends the dated bullet, dispositions the entry and names the file; there is nothing to build, bump or commit.
6. Or dismiss a non-rule (a question, a duplicate): `node "${CLAUDE_PLUGIN_ROOT}/scripts/disposition.mjs" --inbox <inbox> --stamp <stamp> --dismissed "<reason>"`, then commit a project inbox (the user's inbox is not in a repository).
7. After a URULE filing: `node "${CLAUDE_PLUGIN_ROOT}/scripts/reload.mjs" --scratchpad "<this session's scratchpad>"` (`--project` adds `.claude/rules/`, `--all` prints every file; with no scratchpad omit the flag). Read the returned blocks.
8. Report one line per entry: the file (and `§ Heading` for a project rule or specification), or dismissed with the reason. Work dispatched on a specification cites it by that path.

## Which checkout each command writes
- `spec`, `commit` and `migrate` run only in the main checkout, and refuse anywhere else. They write the spec inbox or the rule inbox, which every worktree shares.
- `spec` and `migrate` write the whole slip box into the main checkout: the notes, the structure notes and the generated pages, not only the dictation note.
- `decision`, `ref`, `design`, `plan`, `map` and `regen` write the checkout you are in, because the gate judges the tree being committed.
- So on a branch: your dictation note and its structure note land in main, your ADR lands in the worktree. Expect that, and do not go looking for the note on your branch.

## Filing a SPEC
- A dictation is one note, written once from the inbox entry and never edited. Change is a new note.
1. Read `docs/dictated-specs/INDEX.md` and the flat pages in `docs/spec-current/`.
2. Choose the subsystems (existing, or a new one — a subsystem name is a file name: one path segment, no `/`, `\` or `..`), the `##` topic, the in-force note it supersedes if any, and whether that change is full or partial.
3. Partial: write the superseded note's full text with the change applied to a scratchpad file. It becomes the version note, composed by you.
4. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" spec --stamp <stamp> --subsystems <a,b> --topic "<topic>" --title "<short title>" [--supersedes <id,…>] [--version <file,…>]`. It writes the notes, updates the structure notes, regenerates, dispositions and commits with the full dictation in the message.
   `--supersedes` and `--version` are both comma-separated, and `--version` needs one file per superseded id, in the same order; otherwise it refuses with `--version needs one file per --supersedes id, in the same order`.
5. Show the owner the report: subsystems (new ones marked), topic, the change, and any version note in full.
6. Refused because a supersede left a subsystem out: `--subsystems` must name every subsystem the superseded note is in, or that subsystem would lose its embed with nothing in its stead. Add them and run again.
7. Refused as not migrated: stop, and migrate the project first (§ Migrating a project).
8. Refused by the gate, after the notes were written: `spec` writes the notes, the structure notes and the generated pages, dispositions the entry, STAGES all of it and commits LAST — so a gate refusal leaves every one of those on disk and in the index, and a re-run refuses with `refusing to overwrite … a note is written once`. Undo the run by hand, in this order, then fix what the gate named and run `spec` again.
   - Take the notes, the structure notes and the generated pages back to HEAD, index and worktree together: `git restore --source=HEAD --staged --worktree -- docs/dictated-specs docs/spec-current`. Not `git checkout --`: that restores the worktree FROM the index, and the index is exactly the filing you are undoing, so it changes nothing.
   - Delete whatever is left untracked under those two directories: `git status --porcelain -- docs/dictated-specs docs/spec-current` lists it.
   - Put the inbox entry back: in `.claude/machinery/spec-inbox.md`, change that entry's `## FILED` heading to `## PENDING` and its `disposition:` line to `disposition: PENDING`. Never restore or check out that file — the capture itself may not be committed yet. The disposition line is the one line of an entry you may edit.

## Decisions, designs, plans and maps
- A new ADR: `docs/dictated-specs/decisions/00NN-slug.md`, front matter `kind: decision`, `subsystems`, `rests_on` (the dictation notes behind it). Then `node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" decision --file <path>`. To supersede: a new ADR, the old status line flipped to `Superseded by ADR-00NN`, then `decision --file` on the new one.
- A brainstorming spec, once written: `node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" design --file <path> --subsystems <a,b> [--ticket <n>] [--supersedes <id>]`. A design that supersedes another must list every subsystem that one is in, for the same reason a dictation must.
- On the owner's approval: `node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" design --approve <path>`. Then, for each heading that records a decision, an owner constraint or a principle: `node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" design --embed <path> --subsystem <s> --topic "<t>" --heading "<h>"`. Never an implementation heading such as "Files touched" or "Tests".
- A plan: `node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" plan --file <path> --ticket <n>`; when finished, `plan --file <path> --status done|abandoned`.
- A living map stays outside the slip box: `node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" map --file <path>` once, and link it with `node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" ref --subsystem <s> --path <path>`. Never embed it.
- A stale generated page: `node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" regen`. Never edit `INDEX.md`, `docs/spec-current/` or a structure note by hand.

## Migrating a project
- You fill the plan and apply it. Nothing waits for the owner. The plan file is the record of what was decided.
- Write the plan file to this session's scratchpad, never inside the repository: an untracked file there makes `--apply` refuse for a dirty tree, and the recovery command would delete it.
1. From the main checkout: `node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" migrate --plan <scratchpad>/plan.json`.
2. Fill every `null` and empty list: note titles, subsystems and topics; `supersedes` from the old REVERSED and SUPERSEDED marks; `versions` for partial changes; `ownerNotes` for the owner's own hand-typed rulings; a resolution for each unsettled heading; each superpowers file's kind; design `embeds`; `decisionLinks`; `refs` for living maps; each reference's `replace` pairs with `reviewed: true`.
   - `status` is the exception: a superpowers row that leaves it `null` migrates as `historical`, for a design and for a plan alike (owner, 2026-09-19: only ratified work is approved, "the rest historical"). Spell a status only where the owner ratified something — a design that is `approved` or still `draft`, a plan that is `in-progress`, `done` or `abandoned`. An explicit status always wins.
   - A subsystem name is a file name: one path segment, no `/`, `\` or `..`. The plan check refuses anything else and names it.
   - `ownerNotes` arrives empty and stays empty unless you fill it. The plan cannot tell which of an old spec file's headings are the owner's own rulings, so every heading no note carries arrives in `unsettled`. Read each one. A ruling the owner typed into the file by hand was never captured, so no inbox entry holds its words and commit 2 would delete them: move it across into `ownerNotes` as `{ file, heading, title, subsystems, topic, supersedes, text }`, with `text` copied out of that file byte for byte. It becomes a note with `kind: owner` — in force and embedded like a dictation, and saying in its own first line that it was transcribed, not captured, so the verbatim check cannot prove it. Assistant summaries, ticket lists and open questions stay in `unsettled` and go with the file.
   - `text` is **the owner's ruling and nothing beside it**. A heading usually holds the ruling and the assistant's commentary on it — a reading offered so it can be struck, a summary, a list of tickets. Copy the owner's sentences; leave the rest out. Whatever you leave out stays in `unsettled`, with a resolution saying what it was and why it is not carried, so the omission is on the record and not merely lost. An owner note is **trusted, not proven**: no inbox entry backs it, so gate leg 2 skips it and no check will ever catch assistant prose that rode in inside one. That is why what goes into `text` matters more than it does anywhere else in this plan. The plan check refuses a line that BEGINS with `ASSISTANT`, past any `>` markers, bullet or `**` emphasis in front of it, and quotes the line it found. Measured on ferrislicer's three spec files: 9 of their 11 ASSISTANT lines are caught, and the 2 that are not are mid-sentence mentions inside the owner's own words, which must not be refused. It judges where a line starts and nothing else — it cannot judge prose in general, so the reading is yours.
   - `buildPlan` never emits `kind: map`: it reads the directory only, so every living map arrives as a `design` row. Set that row's `kind` to `map` by hand, or the map is filed as a historical design.
3. Read every `references` row, and sweep for what the rows cannot show. The sweep runs three passes, and each row says in `found` which one caught it: `literal` (`docs/adr` written out in one piece, and every old spec path), `segment` (the bare directory name as a path segment — `"adr"` inside `os.path.join(REPO, "docs", "adr")`, or `/adr/` inside a longer path), `relative-link` (a Markdown link `](adr/…)` or `](../adr/…)`). The last two exist because both shapes went past the literal pass on ferrislicer, twice: without the `os.path.join` rows that project's own CI gate fails after the migration, and twelve relative links sat in three files, two of which the literal pass never listed at all.
   - What no pass can see: a path assembled at RUN TIME — read from config, joined from variables, built by a helper. Those rows do not exist, so look for them yourself: `git grep -n adr` and `git grep -n dictated-specs`, then read every hit that is code rather than prose. Add what you find as a row of your own, with the same fields.
   - Fill each row's `replace` pairs and set `reviewed: true`. A pair is a plain string swap, so choose strings that appear only where you mean them — a `segment` row usually needs the whole construction as its `from`, not the bare name. A row you decide not to rewrite is still reviewed, with `replace: []`.
   - Say in your report what the three passes found and what they cannot reach. Nothing here proves the list is complete.
4. `node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" migrate --apply <plan>`. It makes up to two commits — one for the migrated content, one for the removed old spec files — and skips either when that half has nothing to commit, which is what a second migration looks like. It prints a replacement count per reference file: check each against that file's `matches` in the plan.
5. Refused with `the plan is not ready:` and a list: every `null` and empty list from step 2 that is still unfilled. Fill exactly what it names and run again. This is the refusal a first run usually meets.
6. Refused for a dirty working tree: commit or discard your own changes first, then run again.
   - Refused for a decision link whose ADR reads `Superseded by …`: drop that link, or point it at the successor. Never run `decision --file` on the successor to cure it — a migrated ADR has no front matter, so that command refuses.
7. Refused because a note it would write already exists: this plan has been applied. Do not force it; work out what is left and write a fresh plan.
8. Refused for a `docs/adr` file the migration does not move (anything that is not `.md`): move that file yourself, commit, then run again.
9. Stopped part-way: run the command the error names, exactly as it names it. It is `git reset --hard && git clean -fd` when nothing was committed, and `git reset --hard HEAD~1 && git clean -fd` once the first commit has landed. Resetting to HEAD when a commit landed leaves a half-migrated repository that refuses the next `--apply`. Then fix the plan and apply again.
