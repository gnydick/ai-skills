# CLAUDE.md § Design — full rule

Full pre-telegraphic body, archived verbatim by GIT_696 (2026-08-30) before compression.

### Code
- enforce cant-break-by-design for every decisions

### GUI
- Layout must be validated against the rendered result, not assumed from markup.
  Every interactive element must be fully visible, unobstructed, and within
  reach at all supported viewport sizes. Nothing may be clipped by a container,
  occluded by an overlay or fixed element, or positioned outside the visible area.
- When output is spatial (UI, diagrams, print layout), reason about the
  final rendered geometry. Do not assume plausible-looking source produces
  a usable result.
- Position encodes relationship. Controls must be placed adjacent to the
  element they act on, inside the same visual group, and must move with it.
  A control's scope should be inferable from its location alone: page-level
  actions at page level, region-level actions attached to the region.
  Never separate a control from its target with unrelated content or
  independent layout flow.
