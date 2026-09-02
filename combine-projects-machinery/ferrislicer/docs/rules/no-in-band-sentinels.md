# CLAUDE.md § No in-band sentinels — full rule

A number means that number. Never make `-1`, `0`, `""`, or `9999` stand for unset,
auto, inherit, or disabled.

- Instead: absence is `Option<T>` or an absent key, auto is an enum variant or its
  own bool, numeric fields hold numbers. If an upstream format forces a sentinel,
  convert at the boundary, once, and never let it inland.
- **An empty-collection default is NOT a sentinel.** `-1` standing in for
  "inherit the fill angle" smuggles a DIFFERENT CONCEPT inside a legal angle
  value — that is what this rule forbids. `default = ""` on a list-shaped key
  (`Points`, `PointsGroups`) decoding to "zero elements" is not smuggling
  anything: zero elements IS the value, the same shape as `aliases: Vec<String>`
  using `&[]` for "no aliases" rather than `Option<Vec<_>>`
  (`crates/fs-config/src/defs.rs:54,100`). Two established, distinct patterns,
  told apart by one question: **does absence mean "inherit ANOTHER key's
  value," or "zero elements of THIS key's own collection"?**
  - **Inherits another key → declare NO default, ever.**
  - **Zero elements of its own collection → declare the empty value AS the
    default.** MEASURED: of the registry's 7 `Points`-typed keys, 2
    (`wrapping_exclude_area` :3220, `head_wrap_detect_zone` :5595 — re-pinned
    to current lines GIT_698 2026-08-30; then-lines :2931/:5113) declare
    `default = ""`, matching Orca's own defaults verbatim
    (`G:\CLionProjects\OrcaSlicer\src\libslic3r\PrintConfig.cpp:4428` —
    `new ConfigOptionPoints()`; `:7223` — `new ConfigOptionPoints{}`, both
    empty). `extruder_printable_area`'s `PointsGroups` type (GIT_568,
    `095dae2b`, landed on branch `GIT_566` — at the time NOT yet on `main`,
    which then still carried it as `type = "None"` with no default and no
    UI row) follows the same shape at Orca's
    `G:\CLionProjects\OrcaSlicer\src\libslic3r\PrintConfig.cpp:847` —
    `new ConfigOptionPointsGroups{}`. [Citation repair, GIT_698 2026-08-30:
    the bare `PrintConfig.cpp` line pins were rewritten tree-prefixed; all
    three cited Orca lines (:847, :4428, :7223) re-verified against the
    OrcaSlicer tree and still carry exactly the cited constructors.]
  - Get this backwards in either direction and it breaks differently.
    Fabricate a default for an override key and inheritance silently
    severs — the exact damage this rule exists to stop. Withhold a default
    from a UI-exposed Free-class key (list-shaped or not) and the registry
    BUILD panics: `validate_on_load` (`crates/fs-config/src/generated.rs:583`)
    is true for any UI-listed, non-override, non-text key, and a `None`
    default under a true `validate_on_load` panics at construction
    (`crates/fs-config/src/generated.rs:595-599`).
  - Per § "An accessor that can panic on absence is broken by design"
    below, a Pattern-2 key's accessor is **Free** — a plain value, empty
    allowed — never `Option`; `Option`-returning "absence is the signal" is
    reserved for `overrides.is_some()` keys (Pattern 1).

## Evidence and history

- The type lies. An `f64` whose `-1` means "inherit" is really `Auto | Degrees(f64)`.
  A reader that forgets computes with `-1` and returns a plausible wrong answer
  instead of failing to compile.
- Range checks fight it. `ironing_angle` declared `min = 0` with `-1` load-bearing
  meant every load clamped the sentinel away, turning "inherit the fill angle" into
  "iron at 0°".
- Docs rot around it. C-9 in `docs/config-ssot-suspicions.md`: three comments
  promised "inherit the fill angle"; the engine hardcoded 45°.

Pattern-1 measurement (the rule statement stays in CLAUDE.md):

    MEASURED
    2026-08-27: all 16 `overrides = "..."` keys in
    `crates/fs-config/registry/defs.toml` declare `nullable = true` and no
    `default =` line, 16/16 zero exceptions
    (`filament_retraction_length` :6937, `filament_z_hop` :6947,
    `filament_retraction_speed` :6996, `filament_wipe` :7052, and 12
    siblings). Pinned by
    `validate_on_load_separates_settings_from_actions_and_overrides`
    (`crates/fs-config/src/generated.rs`).

Live measurement from the "get this backwards" bullet (the failure-mode statement
stays in CLAUDE.md):

    Measured live, `095dae2b`
    (GIT_568): a UI-layout regeneration made the then-`type = "None"`,
    no-default `extruder_printable_area` load-validated, and the registry
    panic cascaded to 243 failing `fs-hub --lib` tests before the fix gave
    the key a real type (`PointsGroups`) and a real default (`""`, Orca's
    own empty value).
