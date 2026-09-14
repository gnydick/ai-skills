import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PLUGIN } from './helpers/run.mjs';
import { rulesSource, universalSource, universalInbox, universalCore, projectInbox, markers, pluginRoot, globalIssueTracking, projectIssueTracking } from '../scripts/lib/config.mjs';

test('defaults: rules source is the plugin rules dir; universal inbox beside it', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  process.env.MACHINERY_HOME = home; process.env.CLAUDE_PLUGIN_ROOT = PLUGIN;
  assert.equal(rulesSource(), path.join(PLUGIN, 'rules'));
  assert.equal(universalInbox(), path.join(PLUGIN, 'inbox.md'));
});

test('pluginSource names the universal source; inbox.md and core.md sit in it', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  fs.mkdirSync(path.join(home, '.claude'));
  fs.writeFileSync(path.join(home, '.claude', 'machinery.json'), JSON.stringify({ pluginSource: 'D:/checkout/plugins/machinery' }));
  process.env.MACHINERY_HOME = home;
  assert.equal(universalSource(), path.resolve('D:/checkout/plugins/machinery'));
  assert.equal(universalInbox(), path.resolve('D:/checkout/plugins/machinery/inbox.md'));
  assert.equal(universalCore(), path.resolve('D:/checkout/plugins/machinery/core.md'));
});

test('RED CHECK: a machinery.json still carrying rulesSource is refused, naming pluginSource', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  fs.mkdirSync(path.join(home, '.claude'));
  fs.writeFileSync(path.join(home, '.claude', 'machinery.json'), JSON.stringify({ rulesSource: 'D:/checkout/plugins/machinery/rules' }));
  process.env.MACHINERY_HOME = home;
  assert.throws(() => universalSource(), /"rulesSource" was replaced by "pluginSource"/);
});

test('project paths sit outside the rules directory (spec I12)', () => {
  assert.equal(projectInbox('R'), path.join('R', '.claude', 'machinery', 'inbox.md'));
});

test('markers come from markers.json', () => assert.deepEqual(markers(), { project: 'PRULE:', universal: 'URULE:', spec: 'SPEC:', ambiguous: 'RULE:' }));

test('RED CHECK: a malformed machinery.json is an error, not a silent default', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  fs.mkdirSync(path.join(home, '.claude'));
  fs.writeFileSync(path.join(home, '.claude', 'machinery.json'), '{oops');
  process.env.MACHINERY_HOME = home;
  assert.throws(() => rulesSource(), /machinery\.json/);
});

test('the two issue-tracking paths: the global file under the home\'s .claude/rules, the project file under the project\'s', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  process.env.MACHINERY_HOME = home;
  assert.equal(globalIssueTracking(), path.join(home, '.claude', 'rules', 'global_issue_tracking.md'));
  assert.equal(projectIssueTracking('R'), path.join('R', '.claude', 'rules', 'project_issue_tracking.md'));
});
