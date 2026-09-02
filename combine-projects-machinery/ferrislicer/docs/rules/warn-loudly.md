# CLAUDE.md § Warn loudly — full rule

If we drop, ignore, skip, clamp, substitute, or fail to import anything the user
gave us, say so where they will see it. Silence reads as success.

- "We never tried" counts. Opening an OrcaSlicer `.3mf` takes the geometry and
  discards `Metadata/project_settings.config`, the entire print configuration,
  silently; the file then slices under whatever presets happened to be loaded. "No
  importer yet" is a warning, not an exemption.
- Warn, do not fail. Loading succeeds and the user judges the degraded result. They
  just cannot judge it blind.
- The bar is their expectation, not our contract. Clamping inside the declared range
  is still not the number they typed.
- Model to copy: the G-code config import lists unknown keys, untranslatable keys,
  and clamps, per preset, plus a permanent "REVIEW BEFORE PRINTING: custom G-code is
  carried verbatim, not interpreted."
