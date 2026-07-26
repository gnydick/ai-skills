---
name: cant-break-by-design
description: Use when designing or writing ANY code path, in any language — enforces the absolute rule that invariants must be unrepresentable-by-construction (one pipeline per invariant, bypass = compile error); includes the enforcement ladder, 15 techniques, per-language strongest tools, the tripwire (duplicating a step at a 2nd call site = design already wrong), and 19 anti-patterns that catch invariants whose stated strength exceeds their real mechanism (pub fields under a sole-constructor claim, debug_assert as enforcement, caller preconditions in prose, run-scoped globals, tests standing in for construction)
---

# Skill: apply can't-break-by-design to everything you write

You do not have the choice to design any other way. Before writing a new code
path: (1) name the invariant, (2) pick the highest rung of the enforcement
ladder the language allows, (3) if you catch yourself duplicating a processing
step at a second call site, STOP — the design is already wrong; build the
choke-point/type instead of pasting. New paths get an A/B regression test
proving the invariant holds THROUGH them. A shared helper is the weakest
acceptable form and carries promotion debt; a sole-constructor type is the
standard; deleting the possibility outright is the goal.

**Before writing the doc comment, check §5.** A sentence that sounds like an
invariant usually is not one. If you are about to write "construct via X" beside
`pub` fields, "guaranteed by callers", "should", "in practice", "pinned by a
test", or to guard something with `debug_assert` alone — §5 names the failure and
the rule that preempts it. Assign the rung from the mechanism you can point at,
never from how confident the sentence sounds.

The full reference follows.

---

# Can't Break By Design

A property is enforced **by design** when violating it is *unrepresentable* — no
code you can write within the public surface expresses the broken state. Not
caught at runtime, not covered by a test, not flagged in review: impossible to
say.

**The test:** would a new call site, added by someone who read nothing, still be
correct? If the answer depends on them noticing something, it is not by design.

---

## 1. The ladder

Every invariant must sit as high as the language allows. Touching code near a
low-rung invariant means promoting it.

| Rung | Mechanism | Fails when |
|---|---|---|
| 0 | Comment / documentation | anyone doesn't read it |
| 1 | Convention & review | reviewer blinks |
| 2 | Runtime assert | only after shipping the bad path |
| 3 | Tests | the new path isn't the tested path |
| 4 | Lint / static analysis | rule gaps, suppressions |
| 5 | Shared helper | a call site doesn't call it |
| 6 | Choke-point (sole route) | a new bypass route is added |
| 7 | **Sole-constructor type** | bypass = compile error |
| 8 | **Illegal state unrepresentable** | nothing left to break |

7–8 is the target. 5–6 is the weakest acceptable interim, and only with a ledger
row naming the promotion. 0–4 are support structure, never the enforcement.

---

## 2. Techniques

1. **Illegal states unrepresentable** — `Unloaded | Loaded(T)` over `bool` +
   `Option<T>`; `NonEmpty` over "must not be empty"; direct references over
   parallel arrays indexed by loose IDs.
2. **Parse, don't validate** — validation returns a *new* type carrying the
   proof; after the boundary the unchecked value does not exist.
3. **Smart constructors** — fields private, one blessed factory; obtaining `T`
   *is* establishing `T`'s invariant.
4. **Sealed pipelines and sinks** — the sink accepts only the pipeline's output
   type, whose sole constructor is the pipeline.
5. **Capability objects** — the operation takes a token only the authority
   grants. No token, no call.
6. **Typestate** — the state machine lives in the type. `fn close(self)` makes
   the stale handle unnameable.
7. **Units as types** — never pass raw numbers where unit or frame matters.
8. **Derive, don't duplicate** — a value stored twice will disagree. Store once,
   compute the rest.
9. **Totality and exhaustiveness** — no default arms on domain sums; a new
   variant makes the compiler write the TODO list.
10. **RAII / linearity** — resource lifetime is value lifetime; affine typing
    gives "consumed exactly once".
11. **Immutability by default** — mutation is the marked, scoped exception.
12. **Concurrency by construction** — races: ownership transfer, actors, or
    immutability. Orphans: structured concurrency. Deadlocks: lock order as
    types.
13. **Idempotence / commutativity / monotonicity** — applying twice or out of
    order is defined and identical, so the conflict cannot occur.
14. **Generate, don't hand-maintain** — N artifacts that must agree are one
    artifact plus a generator.
15. **Shrink the trusted core** — small, sealed, the only place the invariant is
    expressible.

---

## 3. Strongest tool per language

Where the language is weak, move the invariant to a stronger layer: types →
codegen → build-time checks → one sealed module with a tiny surface.

| Language | Primary tools |
|---|---|
| **Rust** | enums + exhaustive `match`, ownership, newtypes, private fields + smart constructors, sealed traits, typestate (`PhantomData`), `#[must_use]`, `#[non_exhaustive]`, `Send`/`Sync` |
| **Haskell / OCaml / F#** | ADTs & GADTs, phantom types, smart constructors via module export lists, sealed instances, totality checking |
| **TypeScript** | discriminated unions + `never` exhaustiveness, branded types, `readonly`, private constructors, `satisfies`, `strict` |
| **Kotlin / C# / Java** | sealed classes + exhaustive `when`/`switch`, records with private ctors + factories, non-null types, `init`-only |
| **C++** | RAII, strong typedefs, deleted/`explicit` ctors, `const`, `[[nodiscard]]`, `std::variant` + `visit`, concepts |
| **Go** | unexported types + constructor functions, interfaces as capabilities, `internal/`; design zero values valid or unusable |
| **Python** | `@dataclass(frozen=True)`, `Enum`, `NewType`, `Protocol`, `__slots__`, factory-only modules, `assert_never`, strict mypy in CI |
| **C** | opaque pointers, `static` linkage, handle tables with generation counters |
| **SQL / schemas** | `NOT NULL`, `CHECK`, foreign keys, `UNIQUE`, generated columns, writes only via views/procedures |
| **Shell / YAML / config** | none — generate from a typed source; treat hand-edited config as untrusted input |
| **FFI / wire** | typed wrappers generated from the IDL, one marshaling choke-point |

---

## 4. The process

1. **Name the invariant** before writing the path. If you cannot state it in one
   sentence, the design isn't ready.
2. **Pick the highest rung the language allows.** Shared helper = weakest
   acceptable, carries promotion debt. Sole-constructor type = standard.
   Deleting the possibility = goal.
3. **Tripwire:** duplicating a processing step at a second call site means the
   design is already wrong. Build the choke-point. Never paste.
4. **Stranger test:** would a call site added by someone who read nothing still
   be correct?
5. **New path ⇒ invariant test.** An A/B test proving the invariant holds
   *through* it, plus a red-check proving the test can fail.
6. **Grandfathering:** touching code near a rung ≤5 invariant obligates the
   promotion or a ledger row with its design. Debt is allowed; silent debt is
   not.
7. **When the language can't:** shrink the trusted surface to one sealed module,
   back it with lints, generate the rest.
8. **Both directions.** Enumerate the invariants the feature TOUCHES and the ones
   it INTRODUCES. Entering a sealed pipeline correctly does not make the output
   deserve to exist.
9. **Assign the rung from the mechanism, never the wording.** No named mechanism
   ⇒ rung 0, however confident the claim.
10. **State the invariant and file its row in the same commit.** One that exists
    only in a doc comment is not enumerable, and rule 6 has nowhere to land.
11. **Declare the release behaviour of every profile-dependent guard.**
12. **Offer continuous review; do not assume it.** Ask; take no as an answer.

---

## 5. Anti-patterns

Sentences that sound like invariants and are not. `(inverts N)` names the
technique that fixes it.

**Claim vs mechanism**

- **A5.1 Sole-constructor claims need private fields.** *(3)* "Construct via
  `T::new`" beside `pub` fields is a documented bypass.
- **A5.2 Naming is not prevention.** *(7)* A constructor that can be called
  wrongly will be. Two meanings ⇒ two types, or two names with different
  *return* types.
- **A5.3 Co-location is not a mechanism.** *(8)* "Kept beside each other so they
  cannot drift" prevents nothing. One derives from the other, or they are one
  value.
- **A5.4 "Should" is not a rule.** *(4)* If a consumer can skip it, it is
  advisory. Make the guarded thing the only reachable currency, or file the row.

**Preconditions**

- **A5.5 A caller precondition is a type, not a sentence.** *(2)* "Guaranteed
  non-empty by callers" is a contract on a function that cannot check it. Take
  `NonEmpty<T>`. If not worth minting, the prose must say *unchecked*.
- **A5.6 "Enforcement is the caller's job" means this module has no invariant.**
  *(2)* Accept a type buildable only from conforming input, or record the
  invariant against the caller.

**Duplication**

- **A5.7 A bound may exist in exactly one place.** *(8)* Declared in a schema and
  asserted in a constructor ⇒ they will disagree.
- **A5.8 A mirror needs a generator, not a drift test.** *(14)* A test reports
  divergence after someone writes it.
- **A5.9 Clamping in every setter is the tripwire.** *(3)* One constructor, or a
  range newtype.

**Tests standing in for construction**

- **A5.10 A hand-maintained exception list is debt, and must be filed as debt.**
  Each entry is an invariant someone opted out of; allowlists grow silently.
- **A5.11 "By construction, pinned by a test" is rung 3 — say so.** Reserve "by
  construction" for mechanisms that make the violation unwritable.

**Build-profile divergence**

- **A5.12 `debug_assert` is not enforcement.** *(1)* Rung 2 in one profile,
  nothing in the other: it holds while you develop and vanishes in what you ship.
- **A5.13 Fault isolation must state the profile it works in.** `catch_unwind`
  is inert under `panic = "abort"`. Name what defends the other profile.
- **A5.14 Prefer identical debug and release behaviour.** A bug reproducible in
  only one profile is a bug you debug twice.

**Panics wearing guarantees**

- **A5.15 "Cannot fail in practice" + `.expect` is a panic.** Prove it from the
  types, or return `Result`.
- **A5.16 A silent bounded degrade must publish its divergence point.** Identical
  up to N, first diverging at N+1, with the measurement. A cap without a bound is
  a guess.

**Inert code**

- **A5.17 An invariant on code that cannot run must say so.** *(9)* An unlabelled
  dead guard reads as protection and will be trusted.
- **A5.18 Delete the alternative, don't leave it unused.** *(1)* An unused
  function is a rung-0 invitation.

**Run-scoped state**

- **A5.19 A run-global is rung 2 whenever tests share a process.** *(12)*
  "Property of the run, not of any call" is false in a test binary running
  scenarios concurrently. Thread it, or hand out a handle that cannot be built
  without stating it.

### Red-flag phrases

Each obliges a promotion or a ledger row **in the same commit**:

> "by convention" · "callers must" / "guaranteed by callers" · "should" ·
> "in practice" · "not yet" · "remember to" · "deferred" · "future work" ·
> "hand-maintained" · "kept beside" · "at least visibly" · "documented lenient
> rule" · "pinned by a test" · "debug builds"

---

## 6. Continuous review

A ledger goes stale on the next commit that writes "callers must". If a
background agent maintains it:

- **Scope is recently changed code** — the diff since the last update, nothing
  else. A full sweep is a deliberate, occasional act.
- **Read-only over source.** It proposes; it does not promote.
- **Report the mechanism, not the verdict.** "Rung 3 — enforced by test X" is
  reviewable; "rung 3" is not.
- **A deleted claim is a finding.** Removed prose the ledger cites is either a
  promotion worth recording or an invariant quietly abandoned.
- **Escalate a dropped rung immediately** — a sole-constructor type gaining a
  `pub` field, a choke-point gaining a second caller — rather than batching it.
