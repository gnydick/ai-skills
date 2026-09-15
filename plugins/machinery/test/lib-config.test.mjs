import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PLUGIN } from './helpers/run.mjs';
import * as config from '../scripts/lib/config.mjs';
import { universalInbox, universalRules, projectInbox, markers, globalIssueTracking, projectIssueTracking } from '../scripts/lib/config.mjs';

const home = () => { const h = fs.mkdtempSync(path.join(os.tmpdir(), 'home-')); process.env.MACHINERY_HOME = h; process.env.CLAUDE_PLUGIN_ROOT = PLUGIN; return h; };

// STATUS 54: a universal rule is universal for the USER. Its inbox and its rule file sit under the
// home, where Claude Code loads ~/.claude/rules/*.md into every session, and survive uninstalling
// the plugin. Nothing about them is configurable and nothing points back at the plugin.
test('the universal inbox and the universal rules file are the user\'s: under the home, never in the plugin (STATUS 54)', () => {
  const h = home();
  assert.equal(universalInbox(), path.join(h, '.claude', 'machinery', 'inbox.md'));
  assert.equal(universalRules(), path.join(h, '.claude', 'rules', 'universal.md'));
});

test('RED CHECK: a stray ~/.claude/machinery.json is ignored — valid or malformed, pluginSource or rulesSource, the paths do not move', () => {
  for (const body of [JSON.stringify({ pluginSource: 'D:/checkout/plugins/machinery' }), JSON.stringify({ rulesSource: 'D:/checkout/plugins/machinery/rules' }), '{oops']) {
    const h = home();
    fs.mkdirSync(path.join(h, '.claude'));
    fs.writeFileSync(path.join(h, '.claude', 'machinery.json'), body);
    assert.equal(universalInbox(), path.join(h, '.claude', 'machinery', 'inbox.md'), body);
    assert.equal(universalRules(), path.join(h, '.claude', 'rules', 'universal.md'), body);
  }
});

test('RED CHECK: config.mjs no longer resolves a universal source or a universal core (STATUS 54)', () => {
  for (const name of ['universalSource', 'universalCore', 'rulesSource']) assert.equal(name in config, false, `${name} is still exported`);
});

test('project paths sit outside the rules directory (spec I12)', () => {
  assert.equal(projectInbox('R'), path.join('R', '.claude', 'machinery', 'inbox.md'));
});

test('markers come from markers.json', () => assert.deepEqual(markers(), { project: 'PRULE:', universal: 'URULE:', spec: 'SPEC:', ambiguous: 'RULE:' }));

test('the two issue-tracking paths: the global file under the home\'s .claude/rules, the project file under the project\'s', () => {
  const h = home();
  assert.equal(globalIssueTracking(), path.join(h, '.claude', 'rules', 'global_issue_tracking.md'));
  assert.equal(projectIssueTracking('R'), path.join('R', '.claude', 'rules', 'project_issue_tracking.md'));
});
