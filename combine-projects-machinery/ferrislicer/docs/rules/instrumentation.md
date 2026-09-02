# CLAUDE.md § Instrumentation is not optional — full rule

Full pre-telegraphic body, archived verbatim by GIT_696 (2026-08-30) before compression.

All code carries full instrumentation and flame-chart tracing capability. New
code ships with it; old code gains it ORGANICALLY — whenever a change touches a
site that lacks it, the change adds it. No active retrofit scans.

- Tracing: `#[hotpath::measure]` on every non-trivial function a change adds or
  touches, so the perf ledger and flame charts see it without a second pass.
- Diagnostics: every new decision site gets a default-inert `FS_*` trap or a
  stage-trace row per `docs/dev/traps.md` conventions — denominator stated in
  the output, explicit zeros, probe shape matched to the question, a positive
  control. A new trap registers in the traps.md index in the same change.
- The bar: when this site misbehaves a year from now, can it be interrogated
  without editing code? If not, the change is not done.
