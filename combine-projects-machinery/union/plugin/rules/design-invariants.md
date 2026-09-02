# Design invariants

The design rules that extend the mandatory make-it-unbreakable skill. Loaded at
session start.

## The mandate

- The `cant-break-by-design` skill is mandatory: it is invoked for every design
  decision and every code path, in any language, not consulted when someone
  remembers it. Its rule is the one every other hard rule here is an instance
  of — every design decision makes the bad state structurally impossible rather
  than forbidden by a rule someone has to remember, by a mechanism and never by
  a prose "must".
- The rules below extend that skill and never substitute for it. The rest — the
  enforcement ladder, the techniques, and the anti-patterns where a claim
  outruns its mechanism — is covered by the skill and not restated here.
- The strength rating measures only how hard a rule is to bypass. Whether the
  rule is the right rule is a separate question, checked separately.

## Where a distinguishing type is created

- A distinguishing type is only as strong as the place it is created. Wrapped by
  hand at each call site, two adjacent wrappings can be swapped and the type
  catches nothing. Create it at the authority that reads the source of truth, so
  the source, the direction and the type are declared in one place.
- When the place that creates such a type and the place that consumes it do not
  depend on each other, the type goes in a shared vocabulary unit with no
  dependencies of its own. Making one depend on the other pays for the invariant
  with whatever property that unit was built to have.
- Field privacy is a wall around the enclosing unit, not around the type: while
  the type is declared inside a large file, everything in that file can still
  build one directly. Move it into its own unit, and keep it there with a check
  over the source, because moving it back out compiles perfectly and no compiler
  will report it.
- An automatically generated constructor is a public constructor, and the
  quieter one: a generated empty value builds one from anywhere, and a generated
  decoder fills every private field from untrusted text — while nothing in the
  declaration looks wrong to a reader checking field visibility. Block both with
  a private marker member whose own type supports neither, and keep a source
  check, because deleting that one line compiles.
- Where a claim rests on a type's fields being private, they go private in the
  same change, with proofs that the field read, the direct build and the
  cross-assignment each fail to compile.
- Definitions that could be loaded at run time are compiled in instead, so there
  is no path by which a different set arrives later.

## Weak claims and the enforcement ledger

- Any tool that judges enforcement strength carries the published scale with it,
  so it never judges without it.
- An entry in the ledger anchors on a named thing, never on a line number: a
  line that moves fails silently, a name that changes fails loudly. Where a
  claim has no name of its own, name the thing enclosing it or quote the line
  word for word. The wrong form is refused mechanically, so there is nothing
  left to flag by eye.
- Continuous review of the ledger runs on request or after a merge, never on
  every commit.
- It writes only the ledger, and only when its run was clean.
- Flag anything at all that can fail catastrophically on absence. The sweep is
  unbounded, not limited to the sites someone already suspects.

## Never re-derive a fact

- A fact is computed once, at the place that owns it, and everything else reads
  it. Nothing downstream recomputes its own opinion of a fact that already
  exists, because a second derivation will eventually disagree with the first,
  and that disagreement arrives looking exactly like a defect.
- In a stored or transmitted format, the producer states the fact outright. If a
  consumer has to infer it by arithmetic, the format is wrong: it has forced the
  same re-derivation on every reader, forever.
- A diagnostic dump shows the values the system actually used, never a
  recomputed equivalent. Otherwise the work is judged against something the
  system never saw.
- A classification made where the data is produced is authoritative, and
  everything downstream carries it forward. Consumers never classify the same
  thing again for themselves.

## Measurement and expectation

- The rule against a second opinion governs the working path and inverts inside
  a test's expected value: in the system a second opinion is a defect, but on
  the other side of an assertion it is the whole point. An expectation taken
  from the thing under test can only report that it changed, never that it is
  wrong.
- Take the measurement from the system under test, and the expectation from
  something the system never produced: the stated setting, the fixture's own
  dimensions, the input's own shape, or arithmetic. With both sides from the
  system you have only proved it agrees with itself, and an error affecting
  everything passes.
- A number copied out of a diagnostic run is a pin against regression, not a
  test. On a deterministic system it is useful — every change to it is signal —
  but it is labelled as a pin and never counted as coverage.
- Where an expectation genuinely cannot be derived yet, say so at the assertion
  itself and leave the work undone, rather than pinning today's answer and
  calling it a contract.

## One authority per switch

- The process environment is a fact like any other: every switch is resolved
  once, at one authority per unit, and everything inside reads a field. The
  switch's name appearing anywhere else in that unit is a defect. How often it
  is read is not the criterion; where it is read is.
- The single authority is checked mechanically: it ships a test that scans its
  own unit for environment reads and fails on any site but itself. A comment
  asking people not to stops nobody.
- Reading a field is not always the whole fix: where a switch decides something
  per item, choose the path once outside the loop so the branch disappears
  entirely. A cached read still costs a test per item, and that was explicitly
  rejected as good enough.
- Cost is how this gets noticed, not what the rule is about. Scattered
  authorities are the defect, and the rule holds just as firmly when the
  wasteful reading is a single call per run.
- One authority per unit is where a switch starts, not permission to claim a
  name another unit already owns. A switch two units honour is resolved in the
  one that owns the fact it arms, and the others read the resolved value as
  data. Reading it is not re-deriving; parsing the name a second time is.
- A per-unit check cannot see a name duplicated across units, so a shared name
  is spelled once as one shared definition, and a project-wide check walks every
  unit and fails on a second spelling.
- A table that mirrors where something is emitted is checked mechanically, or it
  is not a table but a claim: gone stale, it tells an operator to turn on
  something that will never fire — the exact silence it existed to prevent. One
  shared check per unit, plus a project-wide sweep, so a unit that grows such a
  table and never opts in is still covered.
- A check built on searching always ships a case proving it still matches. One
  that has quietly stopped matching looks exactly like a codebase that complies.

## Absence and defaults

- A category, flag or case can be used to smuggle information that really wants
  a channel of its own. Before adding or removing one, ask what it was actually
  carrying.
- The ban on stand-in values covers a legal value made to stand for a different
  concept; it never covers a collection's own emptiness.
- Which of the two shapes absence takes is fixed by the setting's class, not by
  the author's taste: an optional is reserved for the case where absence is the
  signal.
- An empty collection used as a default is not a stand-in value: a magic number
  meaning "inherit" smuggles a different concept inside a legal value, whereas
  an empty list decoding to zero elements simply is the value. One question
  separates them: does absence mean inherit another setting's value, or zero
  elements of this setting's own collection?
- If absence means inherit another setting's value, declare no default at all,
  ever. A fabricated default there silently severs the inheritance, which is the
  exact damage this rule exists to prevent.
- If absence means zero elements of that setting's own collection, declare the
  empty value as its default, matching the reference format's own empty
  defaults. Withholding it makes the definition table fail to build.
- This is not "give everything a default". Filling one in everywhere is a
  regression, not a fix, because it silently severs every setting whose absence
  meant inherit.

## The three classes of setting

- First class, a value someone sets directly: it declares a default, its
  accessor returns a plain value, and its absence is impossible by construction
  — not merely believed because some other table happens to carry a matching row
  today.
- Second class, a value computed from others and never authored directly: no
  fixed default means anything for it, and its accessor never falls back to a
  raw lookup of something that was never meant to hold a stored value.
- Third class, an optional override — also free text, actions and templates: no
  default, the accessor returns an optional value, and the caller decides. Here
  absence is the signal, not a gap.
- This sharpens the rule against invented defaults rather than replacing it:
  inventing a value for a setting that should have one stays forbidden. What it
  targets is presence merely believed — resting on some other artifact nobody
  re-checks — rather than enforced when the thing is built or by the return type
  itself.

## External input

- External input never crashes the product. A malformed or truncated file, a
  hand-edited settings file, another product's configuration, a bad command-line
  flag: all of these are data, not your own invariant failing, and they produce
  a diagnostic the user sees.

## Handing a resource on

- Once a stage consumes a resource, that resource is permanently removed from
  what any later stage can receive. The same resource reaching two consuming
  stages is a defect class that keeps recurring, and this is the rule that finds
  it.
- The removal happens before anything downstream is derived from what remains.
  The ordering is part of the rule, not an implementation detail.
- The two ways a stage can decline a resource are different events and never
  share a word: giving back a claim it never exercised, and passing on what it
  could not use of a claim it did.
- A stage that declines a claim it never exercised — nothing produced, nothing
  yet derived downstream — returns the resource to its original owner as if it
  had never been taken, at most once per site, after which it flows through the
  normal division again. The pipeline is the router; the origin holds no routing
  knowledge of its own.
- What is left over from a claim the stage did exercise never travels backward.
  It goes forward to the one successor the design names at that boundary,
  recorded as it goes, and the chain ends either in use or in a declared, warned
  discard.
- Every declined resource has exactly one named recipient. None is a silent
  void; two is a double write.
- The rule is about who consumes a resource, not how many times it may be
  touched. Re-processing something a stage already consumed is fine.
- What gets removed is exactly what the stage actually produced, or formally
  claimed, never a recomputed equivalent. Diagnostics and remainders alike
  observe the real thing.
- The first question in an audit is which two stages both received the same
  resource. It has a lookup answer, because every decline site's recipient is
  named in the design — and a census can only ever see the collision, never the
  handover that caused it.

## Telling the user what you dropped

- Anything the user gave you that gets dropped, ignored, skipped, clamped,
  substituted or never read is said where they will see it. Silence reads as
  success.
- Never having tried counts. Taking part of what a file contains and quietly
  discarding the rest still needs saying: having no reader for something yet is
  a warning, not an exemption from one.
- Warn, do not fail. The operation still succeeds and the user judges the
  degraded result for themselves; they simply cannot judge it blind.
- The bar is the user's expectation, not your documented contract. A value
  clamped to something inside the allowed range is still not the number they
  typed.
- The model to copy is a per-source report listing what was not recognised, what
  could not be translated and what was clamped — plus a standing notice for
  anything carried through word for word and never interpreted, because the
  product cannot vouch for it.

## Wiring honesty

- A field counts as implemented once its storage, its default and its wiring
  into the central hub exist. Whether anything downstream consumes it is a
  different question, and not part of this one.
- That does not relax the separate honesty rule about downstream consumption:
  something can be fully wired at that central point and still owe work further
  along. Both facts are tracked, and neither is allowed to hide the other.

## Reading someone else's data model

- Never narrow a reference format's collection type to a single value because it
  obviously holds only one. That is a judgement call about someone else's data
  model, and those lose. The schema describes their format, not your reader, and
  narrowing it silently drops data on a round trip.
- If you cannot read the collection form yet, write an accessor that could, or
  record the gap. Never write a schema that lies in order to flatter your reader.
- An accessor keeps the name the source format uses, even when it returns a
  collection. Plurality lives in the type, not in a private vocabulary you
  invented.
- Swapping one single-value representation for another can be entirely right,
  when the new one carries a form the old type could not. That is a different
  question, not a decision about plurality.
- Judge whether a value is one or many against the data model actually in front
  of the reader, not the name of the type upstream. Where the store has already
  reduced a key to one value per owner and routes it to the owner it belongs to,
  the plurality lives in that routing, and reading it as a single value is the
  plural-correct read; reading it as a collection returns nothing on every load
  and lets a fallback win instead.

## Spatial output

- Validate a layout against what actually renders, never against the markup that
  produced it: every interactive element fully visible, unobstructed and
  reachable at every supported window size, with nothing clipped by a container,
  hidden behind an overlay, or off the visible area.
- Where the output is spatial, reason about the final rendered geometry. Source
  that looks plausible does not mean a result anyone can use.
- Position encodes relationship: a control sits next to the thing it acts on,
  inside the same visual group, and moves with it. Its scope should be inferable
  from where it is alone, and unrelated content never comes between them.

## Auditing invariants: the denominator

- The denominator of an audit is generated from the material itself, so it is
  reproducible rather than asserted. It lists every entry the audit is obliged
  to dispose of.
- The first half is every stated claim: a comment on something public whose
  words assert an invariant. Of each the audit asks one question — is there a
  mechanism, or only the sentence?
- The second half is the obligation shapes: patterns in the code that carry an
  invariant obligation whether or not anybody ever stated one. Of each the audit
  asks two questions — is it stated, and is it enforced?
- The standing obligation shapes are: a field whose documentation names a
  sibling field; the same fact stored twice, such as a count kept beside the
  collection it counts or a value kept beside a variant of itself; a record
  holding a kind alongside fields meaningful for
  only some of those kinds; a comparison against a magic value or a domain value
  clamped at zero; taking the first or last element of a collection with a call
  that fails when it is empty, where nothing proves it is not; a quantity
  carried as a raw number where a dedicated type already exists; a public
  function with two or more adjacent parameters of the same simple type, which a
  caller can transpose without complaint; public methods that begin, initialise,
  set, finalise, end or reset something mutable, a required order that nothing
  enforces; and a call whose result is thrown away or quietly replaced by a
  default, so a failure has nowhere to be seen.
- Test code inside the shipped units is excluded as not being the shipped
  surface, but dead or test-only code found outside it still gets an entry and
  is dispositioned like any other. Nothing is silently dropped from the
  denominator.
- The generator is deterministic: anything unordered is sorted before it reaches
  the output. Otherwise the same input produces different evidence on different
  runs, which destroys regenerate-and-compare — the verification the whole
  artifact rests on.
- The generator sanitises its own evidence text at the point of writing, so one
  entry can never break into two rows and make the file's line count disagree
  with the entry count.

## Auditing invariants: the output

- The audit table is checked structurally: every row has the declared number of
  columns, every identifier is unique, and every identifier exists in the
  denominator. The check prints the row count, the denominator and how many
  entries remain.
- Every actionable finding lands in exactly one fix, and that is asserted
  mechanically. A fix then cannot be quietly dropped from the work list while
  its findings stay open in the ledger.
- Two artifacts with two jobs: the table is the ledger, dispositioning every
  entry and proving nothing was skipped; the fix list is the work list,
  deduplicated so one remedy appears once instead of once per finding.
- The one judgement call in the report — the order of the fixes, by consequence
  — is labelled as a judgement call. Everything else, the memberships and the
  counts, is derived mechanically.
- Findings already enforced, and findings retired as not really invariants, are
  reported as counts and left out of the work list. They are dispositioned, not
  deleted.
- A shape whose detector cannot yet tell a real obligation from a false positive
  is declared blocked, with the detector work named as the prerequisite. Its
  entries are not called fixes and not called false positives until that runs.
- The report states what the method cannot see: invariants nobody ever wrote
  down that match none of the shapes. It also says row counts are not effort,
  because a large mechanical fix and a small user-visible one look the same in a
  count.

## Carrying instrumentation

- All code carries full instrumentation and profiling capability, and new code
  ships with it rather than acquiring it later.
- Existing code gains instrumentation organically: whenever a change touches a
  site that lacks it, that change adds it. There are no retrofit sweeps, because
  the work rides along with changes that were happening anyway.
- Every non-trivial function a change adds or touches gets the profiling
  annotation in that same change, so the performance record sees it without a
  second pass over the code.
- Every new decision site gets a diagnostic switch or trace row that is inert
  until turned on, and it states its denominator in the output, prints explicit
  zeros rather than omitting them, matches its shape to the question being
  asked, and ships a positive control.
- A new diagnostic switch is registered in the diagnostics index in the same
  change that introduces it, so the list of what can be turned on is never
  behind the code.
- The bar is one question: when this site misbehaves a year from now, can it be
  interrogated without editing code? If not, the change is not done.

## What a diagnostic and a measurement may claim

- How serious a diagnostic is gets decided once, for each diagnostic code, in
  one place. The sites that raise it never pass a level of their own, so the same
  condition cannot come out as a warning in one caller and a passing remark in
  another.
- Each diagnostic code is declared once, in a single entry carrying its
  documentation, its external name and its level together, and everything else —
  the list of codes, the external format, the level table — is generated from
  that entry. A list kept by hand beside it is the denominator of the test that
  guards the format, and a missing line there compiles cleanly while quietly
  narrowing the guard. The external name stays a written-out literal rather than
  being derived from the code's own name, so renaming a code fails loudly
  instead of silently rewriting every message already in the field.
- Whatever a computation warns about comes back as part of its result, never as
  a separate optional output. A separate one lets a caller hand it somewhere
  disposable and drop the warning without anybody noticing.
- A unit that declares itself profiled either instruments something or is named
  on a declared gap list that may only shrink. Where the profiling tool is
  simply not present the instrumentation rule cannot be enforced at all, and
  that absence looks exactly like compliance.
- A profiler that is off by default can never be the source of a number the
  program itself prints. A cost shown to a user keeps its own clock, read once
  at the site that states it, and never a second clock started inside the span
  being measured.
- A measurement of one run is a value that run produces, never a running total
  that outlives it. The counts and the total they are read against travel
  together inside that one value, so a second run in the same process cannot
  report the first run's work over its own count.

<!-- rows: 9.1, 9.11, 9.13, 9.33–9.35, 9.42, 9.51–9.52, 9.72, 9.79, 9.84–9.85, 9.89–9.106, 9.108–9.115, 9.117–9.118, 9.120–9.164, 9.172–9.180, 9.182–9.185 -->
