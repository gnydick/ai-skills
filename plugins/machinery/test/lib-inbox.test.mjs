import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseInbox, appendEntry, setDisposition, pending, formatEntry, newStamp } from '../scripts/lib/inbox.mjs';

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'inbox-')), 'inbox.md');

test('append then parse round-trips verbatim text', () => {
  const f = tmp();
  const e = appendEntry(f, { marker: 'PRULE', text: 'PRULE: never guess\n  second line', session: 's1' });
  const [got] = parseInbox(fs.readFileSync(f, 'utf8'));
  assert.equal(got.state, 'PENDING'); assert.equal(got.marker, 'PRULE'); assert.equal(got.session, 's1');
  assert.equal(got.text, 'PRULE: never guess\n  second line'); assert.equal(got.stamp, e.stamp);
});

test('append-only: the same text twice is two entries (no dedup)', () => {
  const f = tmp();
  appendEntry(f, { marker: 'URULE', text: 'x', session: 's' }); appendEntry(f, { marker: 'URULE', text: 'x', session: 's' });
  assert.equal(parseInbox(fs.readFileSync(f, 'utf8')).length, 2);
});

test('setDisposition flips the heading state and writes the detail line', () => {
  const f = tmp();
  const e = appendEntry(f, { marker: 'PRULE', text: 'x', session: 's' });
  setDisposition(f, e.stamp, { state: 'FILED', detail: 'filed → rules/straight-talk.md § Claims' });
  const [got] = parseInbox(fs.readFileSync(f, 'utf8'));
  assert.equal(got.state, 'FILED'); assert.equal(got.disposition, 'filed → rules/straight-talk.md § Claims');
  assert.equal(pending(f).length, 0);
});

test('pending lists only PENDING entries', () => {
  const f = tmp();
  const a = appendEntry(f, { marker: 'PRULE', text: 'a', session: 's' });
  appendEntry(f, { marker: 'PRULE', text: 'b', session: 's' });
  setDisposition(f, a.stamp, { state: 'DISMISSED', detail: 'dismissed: duplicate' });
  assert.deepEqual(pending(f).map((e) => e.text), ['b']);
});

test('a missing inbox file is an empty inbox', () => assert.deepEqual(pending(path.join(os.tmpdir(), 'nope', 'inbox.md')), []));

test('RED CHECK: a block without a disposition line is rejected as malformed', () => {
  assert.throws(() => parseInbox('## PENDING 2026-01-01T00:00:00Z PRULE s\n\ntext\n'), /malformed/);
});

// Pin, held byte-identical across the formatEntry extraction (issue tracking plan, Task 6 commit A).
test('pin: appendEntry writes exactly this block', () => {
  const f = tmp();
  appendEntry(f, { marker: 'PRULE', text: '  hello\n', session: 's1' });
  assert.match(fs.readFileSync(f, 'utf8'), /^\n## PENDING \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z PRULE s1\n\nhello\n\ndisposition: PENDING\n$/);
});

test('RED CHECK: appendEntry uses the stamp it is given, and writes exactly formatEntry\'s block', () => {
  const f = tmp();
  const e = appendEntry(f, { marker: 'PRULE', text: 'x', session: 's', stamp: '2026-01-02T03:04:05Z' });
  assert.equal(e.stamp, '2026-01-02T03:04:05Z');
  assert.equal(parseInbox(fs.readFileSync(f, 'utf8'))[0].stamp, '2026-01-02T03:04:05Z');
  assert.equal(fs.readFileSync(f, 'utf8'), formatEntry({ stamp: '2026-01-02T03:04:05Z', marker: 'PRULE', text: 'x', session: 's' }));
  assert.equal(newStamp(new Date('2026-01-02T03:04:05.678Z')), '2026-01-02T03:04:05Z');
});
