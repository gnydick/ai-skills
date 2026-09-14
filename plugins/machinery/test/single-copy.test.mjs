import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PLUGIN } from './helpers/run.mjs';
import { pending } from '../scripts/lib/inbox.mjs';

test('agents carry plugin agent frontmatter', () => {
  for (const f of ['comparison-agent.md']) {
    const t = fs.readFileSync(path.join(PLUGIN, 'agents', f), 'utf8');
    assert.match(t, /^---\nname: [a-z-]+\ndescription: .+\n(tools: .+\n)?---/);
  }
});

test('RED CHECK: the universal inbox has no PENDING entries', () => assert.equal(pending(path.join(PLUGIN, 'inbox.md')).length, 0));
