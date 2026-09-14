---
name: design
description: Load when designing or changing a data model, a setting and its default, a pipeline that passes resources between stages, a reader of an external format or user input, an environment switch, a computation that produces warnings, or user-interface layout.
---
> PLACEMENT PENDING — owner has not decided machinery vs parked with unbreakable.

# Design rules

## Facts and types
- Compute each fact or classification once, where it is owned or produced; everything else reads it. A stored or transmitted format states the fact outright.
- Create a distinguishing type in the code that reads its source of truth, never by wrapping at call sites. If creator and consumer do not depend on each other, put the type in a shared unit with no dependencies.
- A type whose invariant rests on private fields lives in its own unit, with generated empty-value and decoder constructors blocked by a private marker member.
- Compile in definitions that could otherwise be loaded at run time.
- Before adding or removing a category, flag or enum case, find out what information it carried.
- Keep the language's conventions (zero-based indexing, native ordering) internally; convert to a presentation form once, at the boundary that produces it.

## Environment switches
- Resolve each switch once, in the unit that owns the fact it arms; everything else reads the resolved field.
- A switch that decides per item chooses the code path once, outside the loop.
- A switch name used by several units is spelled once as a shared definition. A table mirroring where something is emitted is generated from, or checked against, the code.

## Settings and absence
- A directly set setting declares a default; its accessor returns a plain value.
- A computed setting has no default and never falls back to a raw stored lookup.
- An optional override (also free text, actions, templates) has no default; its accessor returns an optional.
- Absence meaning "inherit another setting": declare no default. Absence meaning "zero elements": declare the empty collection. Never default every setting.

## Pipelines that hand on a resource
- When a stage consumes a resource, remove exactly what it produced or claimed from what later stages can receive, before anything downstream is derived.
- A claim a stage never used goes back to its original owner, at most once per site. What is left of a claim it used goes forward to the one successor the design names, recorded, ending in use or a declared, warned discard. The two cases have different names.
- Every declined resource has exactly one named recipient.
- Auditing such a pipeline starts with: which two stages received the same resource?

## External input
- Malformed or truncated files, hand-edited settings, another product's configuration and bad flags never crash the product: show a diagnostic and let the operation succeed.
- Report per source everything dropped, ignored, skipped, clamped (even within range), substituted, not recognised or never read, plus a notice for anything carried through uninterpreted.
- Warnings a computation produces are part of its return value.
- A field counts as implemented once its storage, default and wiring into the central hub exist; downstream consumption still owed is tracked separately.

## Reading someone else's format
- Never narrow a reference format's collection type to one value. If you cannot read the collection form yet, write an accessor that could, or record the gap.
- An accessor keeps the source format's name; plurality lives in the type.
- Decide one-versus-many from the data model in front of the reader: a store that already routes one value per owner is read as one value.

## Layout
- Place a control next to the thing it acts on, in the same visual group and moving with it, with nothing unrelated between them.
