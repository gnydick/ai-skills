// plugins/machinery/test/markers.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findMarkers, resolveMarkers } from '../scripts/lib/markers.mjs';

// #136 § "Where a fact lives in the code": the code cites the decision. A marker is
// `spec:<note-id>` in a source comment; the document lists FILE PATHS ONLY, sorted and
// deduplicated, so one file carrying three markers for one note appears once.
test('a marker in a source comment names its file once, however many times the file carries it', () => {
  const found = findMarkers([
    { path: 'crates/fs-walls/src/lib.rs', text: '// spec:0011-config-overrides\nfn a() {}\n// spec:0011-config-overrides\nfn b() {}\n' },
    { path: 'scripts/tiers.py', text: '# spec:2026-09-07T21-56-14Z\n' },
  ]);
  assert.deepEqual([...found.keys()].sort(), ['0011-config-overrides', '2026-09-07T21-56-14Z']);
  assert.deepEqual(found.get('0011-config-overrides'), ['crates/fs-walls/src/lib.rs'], 'one file, listed once');
  assert.deepEqual(found.get('2026-09-07T21-56-14Z'), ['scripts/tiers.py']);
});

// The invariant: a marker naming a note that does not exist can never reach the document.
// The mechanism is the SHAPE of what resolveMarkers returns — `marked` and `unknown` are two
// lists and there is no third holding both, so a consumer cannot iterate "all markers" and
// include an unresolved one by accident. The gate leg reports `unknown`; the document reads
// `marked`. Neither can reach the other's contents.
const BOX = { notes: new Map([['0011-config-overrides', {}], ['2026-09-07T21-56-14Z', {}]]) };

test('an unknown note is absent from marked, and is reported with the file that carries it', () => {
  const found = findMarkers([
    { path: 'crates/fs-walls/src/lib.rs', text: '// spec:0011-config-overrides\n' },
    { path: 'crates/fs-engine/src/lib.rs', text: '// spec:0099-does-not-exist\n' },
  ]);
  const { marked, unknown } = resolveMarkers(found, BOX);

  assert.deepEqual([...marked.keys()], ['0011-config-overrides'], 'only notes that exist');
  assert.equal(marked.has('0099-does-not-exist'), false, 'the unknown id is not reachable from marked');
  assert.deepEqual(unknown, [{ id: '0099-does-not-exist', paths: ['crates/fs-engine/src/lib.rs'] }]);
});

test('a note that exists but carries no marker is not invented by resolution', () => {
  const { marked, unknown } = resolveMarkers(findMarkers([]), BOX);
  assert.equal(marked.size, 0, 'marked reports what the code cites, never what the box holds');
  assert.deepEqual(unknown, []);
});

// RED CHECK: proves the assertion above could fail — an observer that cannot see a violation is
// not coverage for it. If resolveMarkers ever let an unknown id through, `marked` would carry it
// and this check would be the one that goes red.
test('RED CHECK: a marked map built without resolution does carry the unknown id', () => {
  const found = findMarkers([{ path: 'crates/fs-engine/src/lib.rs', text: '// spec:0099-does-not-exist\n' }]);
  assert.equal(found.has('0099-does-not-exist'), true, 'the scan alone does not filter — resolution is what does');
  assert.equal(resolveMarkers(found, BOX).marked.has('0099-does-not-exist'), false, 'and resolution removes it');
});
