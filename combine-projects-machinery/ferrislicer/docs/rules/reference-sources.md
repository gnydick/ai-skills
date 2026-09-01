# CLAUDE.md § Reference sources — full rule

`G:\CLionProjects\` : `OrcaSlicer`, `PrusaSlicer`, `CrealityPrint`, `SanityPrint`

All four are legitimate reference sources. Cite the tree a fact ACTUALLY came from,
and lead with the one that owns it.

- **OrcaSlicer is FIRST PASS** -- the primary reference, the correctness target, and
  the base of the config dialect. A parity question is answered against Orca.
- **CrealityPrint is a COMPATIBILITY TARGET, not first pass.** It is not banned and
  is never erased: some fields and features exist only in CP, and CP profile
  migration is intended. Cite CP where the thing is CP-only; where a line is about
  lineage or compatibility, keep CP named and let Orca lead.
- **SanityPrint** (Gabe's fork of CrealityPrint) is a reference source in its own
  right, cited DIRECTLY where it is the actual source. It DIVERGES from CP:
  line 9 of `src/slic3r/GUI/Widgets/StateColor.cpp` in each tree carries the
  "ORCA color" -- `#2E86C1` in SanityPrint but `#009688` in both
  CrealityPrint and OrcaSlicer (measured 2026-08-26; re-verified 2026-08-30
  against all three trees during the GIT_698 citation repair).
- **PrusaSlicer** is the ancestry the others descend from.

A citation naming the wrong tree is a defect even when the symbol exists in several
of them: it sends the next reader to a file that does not contain the value. Found
2026-08-26 -- `#2E86C1` was cited to CrealityPrint, appears in zero CP files, and is
SanityPrint's; the CP accent it displaced is used in 19 CP and 46 Orca GUI files.

Reading a reference is not porting it. No verbatim porting from any of these trees:
source is a behavioural contract only, the design is owned, and C++ file/line
citations belong in specs and research docs, never in Ferrislicer code.
