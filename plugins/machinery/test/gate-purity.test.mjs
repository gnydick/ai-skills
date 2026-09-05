import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PLUGIN } from './helpers/run.mjs';

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

test('nothing under scripts/gate writes to the tree (spec I23)', () => {
  for (const f of walk(path.join(PLUGIN, 'scripts', 'gate'))) {
    const src = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(src, /\bfs\.(write|append|rm|mkdir|unlink|rename|copy)\w*\(/, f);
  }
});

// I19 is about the HOOK channel having one writer, and the blanket ban on JSON.stringify is the
// proxy that enforces it. The exempt files serialize a record to a FILE — record-payload.mjs the
// recorded payload, lib/observations.mjs the per-project observation record — and the test below
// holds them to exactly that, so the exemption cannot quietly grow into a second hook-JSON writer.
const SERIALISES_TO_A_FILE = [path.join('record-payload.mjs'), path.join('lib', 'observations.mjs')];

test('JSON.stringify appears only in lib/emit.mjs (spec I19)', () => {
  for (const f of walk(path.join(PLUGIN, 'scripts'))) {
    if (f.endsWith(path.join('lib', 'emit.mjs')) || SERIALISES_TO_A_FILE.some((e) => f.endsWith(e))) continue;
    assert.ok(!fs.readFileSync(f, 'utf8').includes('JSON.stringify('), `${f} stringifies JSON outside emit.mjs`);
  }
});

test('an exempt stringifier writes to a file and never to the hook channel (spec I19)', () => {
  for (const rel of SERIALISES_TO_A_FILE) {
    const src = fs.readFileSync(path.join(PLUGIN, 'scripts', rel), 'utf8');
    assert.match(src, /fs\.write\w*\([^\n]*JSON\.stringify\(/, `${rel} claims a file-writer exemption but writes no file`);
    assert.doesNotMatch(src, /(process\.stdout\.write|console\.log)\(\s*JSON\.stringify\(/, `${rel} writes JSON to the hook channel`);
  }
});

test('RED CHECK: the purity scan sees files', () => assert.ok(walk(path.join(PLUGIN, 'scripts', 'gate')).length >= 4));
