// The code's citation of a note: `spec:<note-id>` in a source comment (#136 § "Where a fact
// lives in the code"). The direction is deliberate — a pointer from the document into code is a
// pointer at a moving target, while a marker travels with the code, so renames, moves and splits
// need no edit at all.
//
// FILE PATHS ONLY, never line numbers, is what makes that true: editing inside a marked file
// changes nothing the document says, so only a move costs a regeneration.

// A comment leader is required. Without one, every mention of `spec:<note-id>` in prose — this
// file, the design note, the skill that documents the marker — would be read as a citation of a
// note named `<note-id>`. The leader is the cheapest thing that separates code from prose, and it
// is already there in every language the marker is written in.
const MARKER = /(?:^|\s)(?:\/\/|\/\*|\*|#|--|;|%)+\s*spec:([A-Za-z0-9][A-Za-z0-9._-]*)/;

// `files` is [{ path, text }]. The caller supplies them, so this never walks a tree itself and
// never decides what is in the repository: the gate hands it the checkout's files, a test hands
// it a fixture's.
export function findMarkers(files) {
  const by = new Map();
  for (const { path: rel, text } of files) {
    for (const line of String(text).split(/\r?\n/)) {
      const m = MARKER.exec(line);
      if (!m) continue;
      if (!by.has(m[1])) by.set(m[1], new Set());
      by.get(m[1]).add(rel);
    }
  }
  // Sorted and deduplicated: one file carrying three markers for one note appears once.
  return new Map([...by].map(([id, paths]) => [id, [...paths].sort()]));
}

// Parse, don't validate. The scan alone cannot tell a citation from a typo, so the ONE place that
// can — the slip box — splits the scan in two and hands back two lists with no third holding
// both. `marked` is what the document renders; `unknown` is what the gate refuses over. There is
// no combined list to iterate, so a consumer cannot include an unresolved marker by accident, and
// a future renderer that takes `marked` cannot be handed a note that does not exist.
//
// Rung 6 of the enforcement ladder (choke-point): this is the sole route from a scan to something
// renderable. It is not rung 7 — nothing stops a caller building its own Map and calling it
// marked. Promotion is a branded type minted only here, and it is worth doing when the composer
// (#136) lands and there is a consumer to protect. Recorded on #136.
export function resolveMarkers(found, box) {
  const marked = new Map(), unknown = [];
  for (const [id, paths] of [...found].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (box.notes.has(id)) marked.set(id, paths);
    else unknown.push({ id, paths });
  }
  return { marked, unknown };
}
