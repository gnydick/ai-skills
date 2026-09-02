# CLAUDE.md § An accessor that can panic on absence is broken by design — full rule

Ruled by Gabe 2026-08-27 (RULE:-dictated), verbatim: **"flag anything that can
panic on absence — literally anything. that's cant-break-by-design."**

- **Not "give everything a default."** Filling a default for every key is a
  regression, not a fix: it silently severs inherit-style override keys
  (`filament_retraction_length`, `filament_z_hop`, `filament_wipe`,
  `filament_retraction_speed`, and siblings — absence there means "inherit the
  base/extruder value"), reproducing exactly the failure § No in-band
  sentinels exists to prevent (a fabricated value standing in for a
  meaningful absence). Every registry key is exactly one of three classes —
  this is not a new taxonomy, it gives TEETH to the "Free, Derived, or
  Enable" honesty states already in the register
  (`docs/RULES-GROUPED.md:249`, 2026-06-22), which is prose today: nothing
  currently makes an accessor's Rust return type (`T` vs `Option<T>`) track
  its key's class.
  - **Free** — a real, directly-set preset value (`overrides.is_none()`, not
    computed, not text/CLI/g-code). Must declare a registry default; the
    accessor returns a plain value; absence must be impossible BY
    CONSTRUCTION, not merely believed because a UI-layout row happens to
    exist today.
  - **Derived / dynamic** — computed by a registered hub relation, never
    authored directly (`infill_spacing`, `e_per_mm` —
    `crates/fs-hub/src/lib.rs:52-100`, `register_slicer_relations`). No
    static default is meaningful; the accessor must never fall through to a
    raw registry read of a key that was never meant to carry one.
  - **Override / optional** (`overrides.is_some()` on `ConfigOptionDef`,
    `crates/fs-config/src/defs.rs:58`; also CLI actions, free text, g-code
    templates) — no default; the accessor returns `Option`, and the caller
    decides. Absence here IS the signal, not a gap.
  In every class a panic is the same defect: a return type that claims
  "always present" without a mechanism that makes that true.
- **Relationship to the no-defaults panic rule (`docs/RULES-GROUPED.md`
  § Config — absent values: no defaults, no sentinels, strict vs tolerant)
  — REFINES, does not supersede.** That rule forbids INVENTING a value for a
  key that should have one; it stands unchanged. This rule answers a
  different question, at a different rung: whether the absence that would
  trigger that panic can occur AT ALL along a Free-class path. A Free key's
  accessor still panics if you bypass the construction that guarantees its
  default — that panic is a legitimate bug report, this rule's target is
  narrower: presence that is merely BELIEVED (contingent on a UI-layout row
  nobody re-derives against) rather than ENFORCED at registry-build time or
  in the accessor's return type. [Citation repair, GIT_698 2026-08-30: this
  bullet originally cited the register by line number; the line had drifted
  to a blank line, so the citation is now by section heading.]
- **The proof this is not hypothetical:** `gradual_start_density(c) -> f64`
  (`crates/fs-hub/src/config.rs:891`, reading `tpms_start_infill_density`,
  called unconditionally from the engine — then-line 14316 of
  `crates/fs-engine/src/lib.rs`, a call site that has since moved) panicked —
  `config key 'tpms_start_infill_density' has no value` — when the GIT_566 UI-
  layout regeneration dropped that key's sole GUI row, flipping its
  `validate_on_load` off and removing the schema fill `req_f` depended on.
  Measured in the GIT_566 worktree's gate logs (battery.log lines 3594-3620,
  4 occurrences; worktree since deleted); NOT reproduced on then-`main`,
  whose generated UI layout (then-line 103 of
  `crates/fs-config/generated/ui_layout.rs`) still carried the row — the
  exposure was latent on `main`, live in the GIT_566 branch pre-fix
  (`cf055872`). Measured on then-`main`: 463 of 510 `validate_on_load=true`
  keys (91%) were backed by exactly one generated UI-layout row with no
  `FERRISLICER_UI_LAYOUT_EXTRA` backup — including `layer_height`,
  `nozzle_diameter`, `wall_loops`, `spiral_mode`, and every other key behind
  the ~53 panic-capable accessors census (docs/INVARIANTS.md § 7.7 Config
  and the 2026-08-28 panic-on-absence accessor-design spec). Any of them
  reproduces the same crash if a future Orca re-scrape drops its row.
  [Historicized GIT_698 2026-08-30: that exposure claim is stale on today's
  `main` — #614's root-cause fix sources `validate_on_load` from
  `is_setting`, not GUI-row presence (docs/INVARIANTS.md § 7.7), so a
  dropped UI row no longer flips validation.] [Citation
  repair, GIT_698 2026-08-30: the engine call-site and UI-layout line pins
  are historical — re-measured today, `gradual_start_density` no longer has
  a direct call at the engine's then-line 14316, and the current
  `crates/fs-config/generated/ui_layout.rs` carries zero
  `tpms_start_infill_density` rows (the GIT_566 merge landed the fix at
  `cf055872`); the hub accessor at `crates/fs-hub/src/config.rs:891` remains
  and still reads the key. The incident narrative is preserved as measured
  at 2026-08-27.]
- **External input never panics.** A malformed/truncated `.3mf`, a
  hand-edited preset, a foreign slicer's config (Orca/Prusa/CrealityPrint/
  SanityPrint import, #608/#610), or a bad CLI flag is DATA, not our own
  invariant failing — it produces a diagnostic the user sees (§ Warn loudly),
  never a crash. Same boundary § No in-band sentinels already names ("convert
  at the boundary, once, and never let it inland"): the boundary resolves
  absence into a value, a typed absence, or a reported rejection; inland code
  needs no panic guard because the unrepresentable state cannot reach it.
  Bears directly on the cross-slicer `.3mf` import work (#608/#610): an
  importer reading someone else's config is exactly where hostile/unexpected
  input arrives.

## Evidence and history

Provenance of the ruling (the dictation itself stays in CLAUDE.md): This
BROADENS a post-mortem's narrower proposal (flag only a wired key whose
`validate_on_load` traces to a single UI-layout source with a panicking
accessor); Gabe rejected that scope as too small — the defect is the PANIC,
not the path that produced it. The post-mortem was triggered by a VIOLATED
ledger on #584/#585 (§ A ledger mismatch launches a post-mortem agent); the
post-mortem write-up itself was not located during filing — only the
underlying incident, which is real and measured (the proof bullet above).
