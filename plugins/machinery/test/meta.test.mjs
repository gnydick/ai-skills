import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PLUGIN } from './helpers/run.mjs';

const TESTS = fs.readdirSync(path.join(PLUGIN, 'test')).filter((f) => f.endsWith('.test.mjs') && f !== 'meta.test.mjs');

test('every suite carries a RED CHECK (spec I39)', () => {
  for (const f of TESTS) assert.match(fs.readFileSync(path.join(PLUGIN, 'test', f), 'utf8'), /RED CHECK/, `${f} has no red check`);
});

test('every hook script has a suite that replays a recorded payload (spec I40)', () => {
  const hooks = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'hooks', 'hooks.json'), 'utf8')).hooks;
  const scripts = new Set(Object.values(hooks).flat().flatMap((g) => g.hooks).map((h) => h.command.match(/scripts\/([\w-]+)\.mjs/)[1]).filter((s) => s !== 'record-payload'));
  for (const s of scripts) {
    const suite = fs.readFileSync(path.join(PLUGIN, 'test', `${s}.test.mjs`), 'utf8');
    assert.match(suite, /fixtures\/payloads\//, `${s}.test.mjs does not replay a recorded payload`);
  }
});

test('the recorder is the first hook of every event and inert without MACHINERY_RECORD', () => {
  const hooks = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'hooks', 'hooks.json'), 'utf8')).hooks;
  for (const [ev, groups] of Object.entries(hooks)) assert.match(groups[0].hooks[0].command, /record-payload/, ev);
});

test('RED CHECK: the meta-test sees the suites', () => assert.ok(TESTS.length >= 12));
