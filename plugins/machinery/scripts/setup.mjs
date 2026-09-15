#!/usr/bin/env node
// Plan Task B1 (recalibration decisions 22, 39, 41): the command the setup skill runs to record a
// project's answers in .claude/machinery/config.json, and to show what is recorded.
//
//   setup.mjs show                 every key: its value, or that it is not recorded and which item asks
//   setup.mjs set <key> <value…>   validate and record one key
//
// Exit codes: 0 done; 1 refused or cannot read (message on stderr, nothing written); 2 usage.
import fs from 'node:fs';
import path from 'node:path';
import { checkoutRoot } from './lib/root.mjs';
import { RULES_DIR } from './lib/layout.mjs';
import { KEYS, recorded, setSetting, render } from './lib/settings.mjs';
// Settings belong to the checkout (STATUS 52): from a linked worktree, its own config.json.

const USAGE = 'usage: setup.mjs show | set <key> <value…>';
const [command, key, ...values] = process.argv.slice(2);

// Owner, 2026-09-14: `.claude/rules/` is a requirement at the beginning of setting the plugin up.
// Install creates it (the plugin's own repo: `node scripts/build-skills.mjs hooks`); without it a
// rule filed after setup dies in place.mjs on ENOENT. Checked on the checkout setup acts on, before
// anything is shown or written.
function requireRules(root) {
  const rules = path.join(root, '.claude', RULES_DIR);
  if (!fs.existsSync(rules)) throw new Error(`${rules} is missing — run /machinery:install first (the machinery plugin's own repo: node scripts/build-skills.mjs hooks), then /machinery:setup`);
}

function show(root) {
  let count = 0;
  const lines = [];
  for (const [k, spec] of Object.entries(KEYS)) {
    const v = recorded(root, k);
    if (v !== undefined) { count += 1; lines.push(`${k}: ${render(v)}`); }
    else if ('default' in spec) lines.push(`${k}: not recorded (default: ${spec.default})`);
    else lines.push(`${k}: not recorded — /machinery:setup ${spec.item}`);
  }
  lines.push(`machinery_setup: ${count} of ${Object.keys(KEYS).length} keys recorded`);
  process.stdout.write(lines.join('\n') + '\n');
}

try {
  const isShow = command === 'show' && key === undefined, isSet = command === 'set' && key !== undefined;
  if (!isShow && !isSet) { process.stderr.write(USAGE + '\n'); process.exit(2); }
  const root = checkoutRoot(process.cwd());
  requireRules(root);
  if (isShow) show(root);
  else {
    setSetting(root, key, values);
    process.stdout.write(`recorded ${key}\n`);
  }
} catch (e) {
  process.stderr.write(`${e.message}\n`);
  process.exit(1);
}
