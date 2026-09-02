import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PLUGIN } from './helpers/run.mjs';
import { rulesSource, universalInbox, projectInbox, projectIndex, markers, pluginRoot } from '../scripts/lib/config.mjs';

test('defaults: rules source is the plugin rules dir; universal inbox beside it', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  process.env.MACHINERY_HOME = home; process.env.CLAUDE_PLUGIN_ROOT = PLUGIN;
  assert.equal(rulesSource(), path.join(PLUGIN, 'rules'));
  assert.equal(universalInbox(), path.join(PLUGIN, 'inbox.md'));
});

test('~/.claude/machinery.json overrides the source', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  fs.mkdirSync(path.join(home, '.claude'));
  fs.writeFileSync(path.join(home, '.claude', 'machinery.json'), JSON.stringify({ rulesSource: 'D:/checkout/plugins/machinery/rules' }));
  process.env.MACHINERY_HOME = home;
  assert.equal(rulesSource(), path.resolve('D:/checkout/plugins/machinery/rules'));
  assert.equal(universalInbox(), path.resolve('D:/checkout/plugins/machinery/inbox.md'));
});

test('project paths sit outside the rules directory (spec I12)', () => {
  assert.equal(projectInbox('R'), path.join('R', '.claude', 'machinery', 'inbox.md'));
  assert.equal(projectIndex('R'), path.join('R', '.claude', 'machinery', 'INDEX.md'));
});

test('markers come from markers.json', () => assert.deepEqual(markers(), { project: 'PRULE:', universal: 'URULE:', ambiguous: 'RULE:' }));

test('RED CHECK: a malformed machinery.json is an error, not a silent default', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  fs.mkdirSync(path.join(home, '.claude'));
  fs.writeFileSync(path.join(home, '.claude', 'machinery.json'), '{oops');
  process.env.MACHINERY_HOME = home;
  assert.throws(() => rulesSource(), /machinery\.json/);
});
