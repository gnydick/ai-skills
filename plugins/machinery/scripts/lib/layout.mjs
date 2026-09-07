// The one spelling of every machinery file name that more than one unit has to name.
//
// Ticket #81 (owner, 2026-09-07: "move INDEX.md to RULES_INDEX.md and create a SPEC_INDEX.md for
// specs"). Two units name these files and neither can import the other: lib/config.mjs resolves
// paths for the hooks and the intake, and gate/gate.mjs builds its own layout because it ships
// standalone into an adopting project and must not point back at the plugin cache (spec I6). A name
// spelled in two places is a name that can drift, so it is declared once here and both read it —
// rules/design-invariants.md § One authority per switch, "a shared name is spelled once as one
// shared definition".
//
// LEGACY_RULES_INDEX is the pre-#81 name. It is not an alias and nothing resolves to it: it exists
// so the installer can find an old index to rename and the gate can name the migration instead of
// reporting a missing file. Delete it only when no project can still be carrying one.
export const RULES_INDEX = 'RULES_INDEX.md';
export const LEGACY_RULES_INDEX = 'INDEX.md';
export const SPEC_INDEX = 'SPEC_INDEX.md';
export const INBOX = 'inbox.md';
export const SPEC_INBOX = 'spec-inbox.md';
// Project-relative directories. Specs sit beside rules under .claude/ by the same symmetry: the
// ruling settled the spec location by reusing the rules layout rather than by declaring a root.
export const RULES_DIR = 'rules';
export const SPECS_DIR = 'specs';
export const MACHINERY_DIR = 'machinery';
export const REGISTER_DIR = 'register';
