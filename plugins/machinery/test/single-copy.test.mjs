import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PLUGIN } from './helpers/run.mjs';

test('agents carry plugin agent frontmatter', () => {
  for (const f of ['comparison-agent.md']) {
    const t = fs.readFileSync(path.join(PLUGIN, 'agents', f), 'utf8');
    assert.match(t, /^---\nname: [a-z-]+\ndescription: .+\n(tools: .+\n)?---/);
  }
});

// STATUS 54: the universal inbox is the user's (~/.claude/machinery/inbox.md), so the plugin ships
// no inbox at all — a file here would be a second inbox nothing reads.
test('RED CHECK: the plugin ships no inbox.md — the universal inbox is the user\'s (STATUS 54)', () => assert.equal(fs.existsSync(path.join(PLUGIN, 'inbox.md')), false));
