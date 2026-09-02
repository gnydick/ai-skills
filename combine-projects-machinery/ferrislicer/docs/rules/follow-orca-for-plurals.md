# CLAUDE.md § Follow Orca for plurals — full rule

Never scalarise an Orca vector type because it "obviously" holds one value. That is
a judgement call on someone else's data model, and those lose.

- The schema describes Orca's format, not our reader. Scalarising also eats data on
  round trip: read `0.3|0.5`, write `0.3`.
- Cannot read it as a vector yet? Vector-aware accessor, or a recorded gap. Never a
  schema that lies to flatter the reader.
- Accessors keep the key's name. `flush_multiplier` returns `Vec<f64>`, it does not
  become `flush_multipliers`. Plurality lives in the type, not in a private vocabulary.
- Swapping one scalar representation for another is a different question and can be
  right (`outer_wall_line_width` to `String`, to carry the `Nx` form `FloatOrPercent`
  cannot hold). Not a plurality call.

## Evidence and history

- Three such calls in the config-SSoT campaign, three wrong: `flush_multiplier` is
  per head (`get_at(new_extruder_id)`), `nozzle_type` per extruder (a dual head can
  run hardened steel and brass), `small_area_infill_flow_compensation_model` is a
  multi-line table.
- All three failed silently. A scalar reader returns `None` on a vector, `None` means
  absent, the accessor's fallback wins. Wrong type becomes wrong value, unraised.
  Wrong values are loud; wrong types are quiet.
