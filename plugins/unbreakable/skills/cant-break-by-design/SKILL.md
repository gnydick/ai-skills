---
name: cant-break-by-design
description: Use when designing or writing ANY code path, in any language — enforces the absolute rule that invariants must be unrepresentable-by-construction (one pipeline per invariant, bypass = compile error); includes the enforcement ladder, 15 techniques, per-language strongest tools, and the tripwire (duplicating a step at a 2nd call site = design already wrong)
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

The full reference follows.

# Can't Break By Design

**The definition.** A property is enforced *by design* (equivalently: *by
construction*, *correct-by-construction*) when the program is structured so that
violating the property is **unrepresentable** — there is no sequence of code a
programmer can write, within the public surface of the system, that expresses
the broken state. Not "caught at runtime," not "covered by a test," not "flagged
in review": **impossible to say**. The bug class is removed from the language of
the program, so it needs no vigilance, no discipline, and no memory — including
from the people (and AIs) who come later.

The test for whether something is by-design: *"If a competent stranger adds a
new call site / feature / field tomorrow, without reading any documentation, is
the invariant still guaranteed?"* If the answer depends on them noticing
something, it is not by design.

---

## 1. The enforcement ladder

Every invariant in a system sits on this ladder. The standing rule: **every
invariant must sit as high as the implementation language allows**, and touching
code near a low-rung invariant means promoting it.

| Rung | Mechanism | Fails when | Verdict |
|---|---|---|---|
| 0 | Comment / documentation | anyone doesn't read it | not enforcement |
| 1 | Convention & code review | reviewer blinks | not enforcement |
| 2 | Runtime assert / exception | only after shipping the bad path | detection, not prevention |
| 3 | Tests | the new path isn't the tested path | pins known cases only |
| 4 | Lint / static analysis rule | rule gaps, suppressions | good fence, not a wall |
| 5 | Shared helper ("call this function") | a call site doesn't | single implementation, optional use |
| 6 | Choke-point (sole visible route) | a new bypass route is added | strong, still structural discipline |
| 7 | **Sole-constructor type** (bypass = compile error) | — | by design |
| 8 | **Illegal state unrepresentable** (nothing to enforce) | — | by design, nothing left to break |

Rungs 7–8 are the target. Rung 5–6 are the *weakest acceptable interim* and
only with a ledger entry saying what the promotion looks like. Rungs 0–4 are
support structure (tests pin the construction; asserts guard the trusted core's
own math), never the enforcement itself.

**Case study (a slicer implementation, 2026-07-19):** infill anchoring lived as an inline step
in one emission path (rung 1). A new emission path (the transition ramp)
silently skipped it — printed regression. First fix attempt copied the block to
the second site (still rung 1, now with duplication). Correct fix: one emission
route through which every sparse fill must pass (rung 6), to be promoted to a
sealed emitter type whose only constructor runs the pipeline (rung 7). The
tripwire that should have fired: **the moment a processing step is duplicated at
a second call site, the design is already wrong.**

---

## 2. The techniques (language-independent)

Each technique is a way of moving an invariant up the ladder. They compose.

### 2.1 Make illegal states unrepresentable
Model data so invalid combinations have no encoding. A struct with
`is_loaded: bool, data: Option<Bytes>` can express `is_loaded && data == None`;
a sum type `Unloaded | Loaded(Bytes)` cannot. Replace flag clusters with
enums/unions; replace "list that must not be empty" with a `NonEmpty` type that
stores `(first, rest)`; replace parallel arrays indexed by loose IDs with
objects holding direct references (the slicer's "objects, not index tables"
rule).

### 2.2 Parse, don't validate
Validation that returns the *same* type it received proves nothing to the code
after it. Validation must return a **new type** that carries the proof:
`fn parse(s: &str) -> Result<Email, Error>` — and everything downstream demands
`Email`, never `&str`. The check happens once, at the boundary; after the
boundary the unchecked value *does not exist*.

### 2.3 Smart constructors / sealed types
The only way to obtain a value of type `T` is the function that establishes
`T`'s invariant. Fields private; constructor private; one blessed factory. A
`SortedVec` whose only builders sort; an `ExtrusionPath::new` that computes
flow from width so a path carrying a width that disagrees with its volume
cannot exist (the slicer).

### 2.4 Sealed pipelines and sinks
When the invariant is "every X passes through steps A→B→C," the *sink* must
accept only the pipeline's output type, and that type's only constructor is the
pipeline. Emitting, logging, writing, sending — the sink's parameter type IS
the enforcement. ("There shouldn't be a way to draw infill without anchoring
it. One pipeline, no mistakes.")

### 2.5 Capability / permission objects
An operation that requires authority takes a token type as a parameter, and the
token is only granted by the authority. No token, no call — the permission
check cannot be forgotten because it is the *ability to name the operation*.
(OS handles, session objects, the slicer's `GCodeWriter::new(EMode)` — you
cannot write E without declaring the mode.)

### 2.6 Typestate
Encode the state machine in the type: `Connection<Closed>` has `open()`,
`Connection<Open>` has `send()` and `close()`, and no type has both. Misuse
(send-before-open, double-close) is a compile error. Ownership-transferring
methods (`fn close(self)`) make the stale handle unnameable afterwards.

### 2.7 Units and domains as types
Never pass raw numbers across a boundary where the unit or frame matters:
`Scaled` vs `Mm`, `LayerIndex` vs `ExtruderIndex`, `Celsius` vs `Fahrenheit`.
Mixing becomes a type error. (Mars Climate Orbiter is the canonical funeral.)

### 2.8 Derive, don't duplicate — one source of truth
A value stored twice will disagree eventually. Store it once; everything else
is *computed* from it, at use time or via a build step. Caches must be
transparently keyed to the authority (or carry generation stamps checked by
type). The slicer: the config hub's derived relations; the filament estimate
priced through the same `price_e_per_mm` the writer uses — the estimate cannot
drift from the emission because there is only one pricer.

### 2.9 Totality and exhaustiveness
No default arms on domain sums: when a variant is added, every match site
becomes a compile error — the compiler generates the TODO list. Prefer total
functions (every input has a defined result) over partial ones guarded by
callers. Where a language lacks sum types, generate the dispatch from a single
schema so the arms cannot be out of sync (the slicer's compiled config schema).

### 2.10 RAII / ownership / linearity
Tie resource lifetime to value lifetime: acquisition is construction, release
is destruction. Leaks, double-frees, use-after-close become unrepresentable or
compile errors. Linear/affine typing (Rust ownership) extends this to "this
value must be consumed exactly once" — protocol steps can't be skipped or
repeated.

### 2.11 Immutability by default
What cannot be mutated cannot be corrupted, raced, or half-updated. Make
mutation the marked, scoped exception (builders that freeze, persistent data
structures, `frozen` records). Shared-mutable is the state to make
unrepresentable, not the default to discipline.

### 2.12 Concurrency by construction
Data races: make the race unrepresentable — ownership transfer (Rust
`Send`/`Sync` as compiler-checked traits), actors/channels (share by
communicating), or immutability. Orphaned tasks: structured concurrency —
a task can only be spawned inside a scope that must join it. Deadlocks: lock
ordering as types (acquire `L2` only via a token proving `L1` is held).

### 2.13 Idempotence, commutativity, monotonicity
When retries, reorderings, or merges are possible, design operations so that
applying them twice / out of order / concurrently is *defined and identical* —
CRDTs, idempotency keys as types, append-only logs. The conflict isn't
handled; it cannot occur.

### 2.14 Generate, don't hand-maintain
N artifacts that must agree (schema ↔ parser ↔ docs ↔ UI ↔ migrations) are one
artifact plus a generator. Hand-synchronization is a rung-1 invariant; codegen
makes agreement structural. Runtime-loadable definitions reopen the attack
surface — compile them in (the slicer's config schema rule).

### 2.15 Shrink the trusted core
Some kernel of code must be trusted (the parser, the unsafe block, the FFI
edge). By-design means making that kernel *small, sealed, and the only place
the invariant is even expressible* — everything outside is safe by types. The
measure of a design is how little code could possibly contain the bug.

---

## 3. Per-language: the strongest tools available

The rule is language-relative: **use the strongest form the language affords,
and where the language is weak, move the invariant into a stronger layer**
(types → codegen → build-time checks → a sealed module with a tiny surface).

| Language | Primary by-design tools | Notes / ceiling |
|---|---|---|
| **Rust** | enums + exhaustive `match`, ownership/borrowing, newtypes, private fields + smart constructors, sealed traits, typestate (`PhantomData`), `#[must_use]`, `#[non_exhaustive]`, `Send`/`Sync` markers, lifetimes as scopes, const generics | The reference ceiling. Affine types make protocol misuse unrepresentable. `unsafe` is the trusted-core marker — minimize and seal it. |
| **Haskell / OCaml / F#** | ADTs & GADTs, phantom types, smart constructors via module export lists (don't export the data constructor), type classes with sealed instances, refinement types (LiquidHaskell, F* ), totality checking | GADTs encode proofs in values; purity makes effects visible in types (`IO`). |
| **TypeScript** | discriminated unions + `never` exhaustiveness, branded/opaque types (`type Email = string & {readonly __brand: unique symbol}`), `readonly`, private constructors, `satisfies` | Erased at runtime: the boundary (rung where JS enters) must parse-don't-validate (zod etc. producing branded types). `strict` mode is mandatory or the ladder collapses. |
| **Kotlin / C# / Java** | sealed classes/interfaces + exhaustive `when`/`switch`, records with private ctors + factories, non-null types (Kotlin) / NRT (C#), `init`-only, enums with behavior | Reflection and serialization frameworks are bypass holes — seal them (private ctors honored, no setter injection). |
| **C++** | RAII, strong typedefs (enum class, tagged wrappers), deleted/`explicit` ctors, `const`, `[[nodiscard]]`, `std::variant` + `std::visit` (no default), concepts, private ctor + factory `friend` | UB is the ceiling-breaker: by-design in C++ includes *banning the constructs* (raw owning pointers, unions, manual delete) via vocabulary types + clang-tidy as rung 4 backing. |
| **Go** | unexported types + constructor functions, interfaces as capabilities, `internal/` packages | No sum types: emulate sealing with unexported interface methods; exhaustiveness needs a linter. Zero values are a standing hole — design types whose zero value is *valid or unusable*, never *plausible-but-wrong*. |
| **Python** | `@dataclass(frozen=True)`, `Enum`, `NewType`, `Protocol`, `__slots__`, factory-only modules, `match` exhaustiveness via `assert_never` | Dynamic: the "compiler" is mypy/pyright in strict CI — without it everything is rung ≤4. Runtime `__init__` guards are rung 2; the real move is generating/validating at boundaries into typed frozen objects. |
| **C** | opaque pointers (incomplete struct in header, definition in one .c), `static` linkage, handle tables with generation counters, MISRA subset | Weakest ceiling: push invariants into **codegen** and keep the handwritten surface tiny. The header IS the capability system — what's not declared can't be called. |
| **SQL / schemas** | `NOT NULL`, `CHECK`, foreign keys, `UNIQUE`, generated columns, normalized schema (derive, don't duplicate), transactions as the only write path (via views/procedures) | Application-side "we always write consistently" is rung 1. The constraint in the database is the type system of the data. |
| **Shell / YAML / config** | none — that's the answer | Do not encode invariants here. Generate config from a typed source; treat hand-edited config as untrusted input to a parser (2.2). Runtime-loadable schemas are an attack surface (the slicer's rule: compile them in). |
| **Hardware / protocols / FFI edges** | typed wrappers generated from the IDL/spec, single marshaling choke-point | The wire is untyped by nature: exactly one module may touch raw bytes; everything else sees parsed proof-carrying types. |

---

## 4. The process (how this rule is applied, every time)

1. **Name the invariant** before writing the code path. If you cannot state it
   in one sentence, the design isn't ready.
2. **Pick the highest rung the language allows.** A shared closure is the
   weakest acceptable form and carries a promotion debt; a sole-constructor
   type is the standard; deleting the possibility outright (2.1) is the goal.
3. **The tripwire:** duplicating a processing step at a second call site means
   the design is already wrong. Stop. Build the choke-point. Never paste.
4. **The stranger test** (from the definition): would a new call site added by
   someone who read nothing still be correct? If not, keep climbing.
5. **New path ⇒ invariant test.** Tests don't police the invariant per-call —
   the type does — but every new path gets an A/B test proving the invariant
   holds *through* it (and a red-check proving the test can fail).
6. **Grandfathering:** touching code near a rung ≤5 invariant obligates the
   promotion, or a ledger entry with the promotion's design. Debt is allowed;
   silent debt is not.
7. **When the language can't:** shrink the trusted surface to one sealed
   module, back it with rung-4 lints, and generate the rest. "The language is
   weak" changes the technique, never the requirement.
8. **A new feature's invariants — both directions.** Enumerate the invariants
   the feature TOUCHES (existing pipelines it must enter) and the invariants it
   INTRODUCES (properties its own output must hold). An unnamed invariant
   cannot be constructed, so it ships at rung 0. **Second case study
   (2026-07-19, same day):** the transition ramp entered the sealed anchoring
   pipeline correctly — and still shipped garbage, because "band fills must be
   coherent printable chains" was an invariant the feature CREATED and nobody
   named: TPMS fields at per-band densities tore into anchored-but-chaotic
   fragments. The sealed pipeline guaranteed every polyline was anchored; it
   could not guarantee the polylines deserved to exist. Rule 8 exists because
   rule-following on touched invariants is not a substitute for naming the new
   ones.

---

## 5. Standing examples (a slicer implementation's ledger)

| Invariant | Construction | Rung |
|---|---|---|
| E-values match the declared extruder mode | `EToken`/`ETracker`: writers cannot emit E except through the tracker; `GCodeWriter::new(EMode)` required | 7 |
| A bead's width agrees with its extruded volume | `ExtrusionPath::new` computes `mm3_per_mm` from (width, height); no caller-supplied volume | 7 |
| Estimate equals emitted filament | one pricer (`price_e_per_mm`) used by both writer and report | 8 (derived, not duplicated) |
| Config values are real preset values | no defaults anywhere; registry is schema-only; derived keys are hub relations | 8 |
| Schema can't be tampered at runtime | build-time codegen, compiled in | 8 |
| Same-layer extrusions don't overlap | ownership convention: the denser fill owns a shared edge, neighbors retreat — geometric construction, pinned by scans | 6→7 (regionwise) |
| Travels don't fire retracts spuriously | `travel_guarded` policy as the only travel path in main loop emitters | 6 |
| Sparse fill is always anchored | **incident 2026-07-19**: was rung 1 (inline in one path), broke; PROMOTED same day: `FillRole` (no sparse variant — `tag` cannot express it) + `SparseEmit`, the sole sparse route, every door anchored (`lattice`/`combined`) or construction-anchored by name (`self_anchored`, the island welds). Six call sites, one pipeline; the conversion also closed two more latent holes (modifier zones and combined infill had never anchored) | 7 |

---

## 6. The one-paragraph form

> A system can't break by design when every invariant is either structurally
> impossible to violate (the broken state has no representation) or guarded by
> a single sealed pipeline whose output type is the only currency the rest of
> the system accepts — so that correctness does not depend on any future
> person remembering, noticing, or agreeing. Checks detect; tests pin;
> reviews advise; **types and sole constructors forbid**. Design at the
> forbid level, in every language, at the highest rung the language allows,
> and treat any duplicated step or second code path as proof that the design
> has not reached it yet.
