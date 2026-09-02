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

test('JSON.stringify appears only in lib/emit.mjs (spec I19)', () => {
  for (const f of walk(path.join(PLUGIN, 'scripts'))) {
    if (f.endsWith(path.join('lib', 'emit.mjs')) || f.endsWith('record-payload.mjs')) continue;
    assert.ok(!fs.readFileSync(f, 'utf8').includes('JSON.stringify('), `${f} stringifies JSON outside emit.mjs`);
  }
});

test('RED CHECK: the purity scan sees files', () => assert.ok(walk(path.join(PLUGIN, 'scripts', 'gate')).length >= 4));
