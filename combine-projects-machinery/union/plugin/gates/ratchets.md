# Standing-measurement ratchet

One leg of the merge gate, over a measuring tool that reports a large, already
audited standing count. It is a ratchet rather than a pass-or-fail on absolute
numbers because an absolute gate over that count would be red the day it
landed, and a gate that is red on arrival is one everybody learns to ignore.

**When it runs:** Inside the merge gate, as one leg, after the measuring tool's
own tests have run and passed in that same leg.

**What it reads:**

- The measuring tool's output: per-category finding counts, its own
  files-parsed line, and its per-category skip lines.
- A committed baseline file mapping each category to its accepted count.
- Its own regeneration flag, when one was passed.

**What it does:**

1. Run the measuring tool's own tests first. It is a tool the ordinary suite
   never reaches, so nothing else ever runs them — and a check nothing runs is
   not enforcement, which is a defect this very kind of tool exists to detect.
   If they fail, the leg fails there and the counts are never read.
2. Run the measurement over shipping code only. The non-shipping siblings of
   the source directory are skipped.
3. Parse the output into per-category counts, the files-parsed line, and every
   skip line.
4. Echo the files-parsed line and every skip line to the leg's own output, not
   only into its log. An exclusion nobody can see is indistinguishable from a
   walk that missed those files, because both print a clean result.
5. Refuse a nothing result. If there are no categories at all, or no
   files-parsed line, or that line reports zero files parsed, fail loudly and
   stop. A detector that finds nothing is broken until proven otherwise, and so
   is a scan that read no files: both look exactly like a clean result.
6. If the regeneration flag was passed, write today's counts as the new
   baseline, report how many categories were written, and stop without judging
   anything. Regeneration happens only behind that explicit flag, only in a
   reviewed commit, never automatically, and only once somebody has decided
   that the change to the failing set is correct.
7. If the baseline file is missing and no flag was passed, fail, naming the
   file and saying it is generated deliberately in a reviewed commit.
8. Compare category by category:
   - **Above the baseline: fail**, naming the category and both numbers. That
     is new debt, and stopping it arriving quietly is what the gate is for.
   - **Below the baseline: report**, so the baseline is lowered in the same
     change that earned the drop. This does not fail — but a ratchet nobody
     tightens stops being one.
   - **Equal:** nothing.
   - **In the measurement, absent from the baseline: fail.** A category the
     baseline has never seen is adopted deliberately, in a reviewed change
     behind the regeneration flag, never silently.
   - **In the baseline, absent from the measurement: report for update.** It
     may mean the work is done or that the detector stopped detecting, and
     silence hides both.
9. Print the leg's own count line every run — the number of categories and the
   verdict — in the declared proof-line format, so it survives the output
   filter and the gate's log redirect.
10. Exit non-zero on any failure, zero otherwise: a drop and a vanished
    category are reports, not failures.
11. When the measurement's scope is corrected, rewrite the baseline from the
    corrected measurement, in the same change. Keeping the old numbers would
    forgive real debt along with the part that was miscounted.
12. Read a count dominated by work some other standing rule required as a scope
    error, not as strictness. A gate that punishes compliance with another
    standing rule is miscalibrated, and the scope is what is wrong.
13. Record how big each known problem is, not merely that it exists. A census
    of presence alone lets a defect double in place while the gate stays green.

**What the user sees:** its own count line every run, plus one line per finding:

```
<check name>: <n> detectors, OK
<check name>: <n> detectors, FAIL
<n> files parsed
SKIPPED <category>: <n>
FAIL: <category> rose <old> -> <new> (new by-construction debt)
FAIL: new detector '<category>' (<n>) not in baseline - add it deliberately with the regeneration flag
FAIL: scan produced no counts / parsed no files (<what the parsed line said>)
FAIL: baseline missing (<path>); generate with the regeneration flag in a reviewed commit
RATCHET: <category> dropped <old> -> <new> - lower the baseline in this change
RATCHET: detector '<category>' vanished - update baseline
baseline written: <n> detectors
```

**Acceptance checks:**

- Given a baseline and a measurement equal to it in every category, when the
  leg runs, then it passes and prints its category count, its files-parsed line
  and its per-category skip counts on the leg's own output.
- Given one category one above its baseline, then the leg fails naming that
  category and both numbers; given one below, then the leg passes and prints
  the instruction to lower the baseline in this change.
- Given a category the measurement produces that the baseline has never seen,
  then the leg fails rather than adopting it; given a category the baseline
  holds that the measurement no longer produces, then the leg passes and
  reports it for update.
- Given a measurement that produces no categories at all, or that reports zero
  files parsed, then the leg fails; neither reads as clean.
- Given the regeneration flag, then the baseline is overwritten from today's
  measurement and nothing is judged; given no baseline file and no flag, then
  the leg fails naming the file.
- Given the measuring tool's own tests failing, then the leg fails there and
  the counts are never read at all.

<!-- rows: 15.21–15.30, 15.35 -->
