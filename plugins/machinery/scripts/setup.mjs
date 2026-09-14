#!/usr/bin/env node
// Plan Task B1 (recalibration decisions 22, 39, 41): the command the setup skill runs to record a
// project's answers in .claude/machinery/config.json, and to show what is recorded.
//
//   setup.mjs show                 every key: its value, or that it is not recorded and which item asks
//   setup.mjs set <key> <value…>   validate and record one key
//
// Exit codes: 0 done; 1 refused or cannot read (message on stderr, nothing written); 2 usage.
import { projectRoot } from './lib/root.mjs';
import { KEYS, recorded, setSetting, render } from './lib/settings.mjs';

const USAGE = 'usage: setup.mjs show | set <key> <value…>';
const [command, key, ...values] = process.argv.slice(2);

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
  if (command === 'show' && key === undefined) show(projectRoot(process.cwd()));
  else if (command === 'set' && key !== undefined) {
    setSetting(projectRoot(process.cwd()), key, values);
    process.stdout.write(`recorded ${key}\n`);
  } else { process.stderr.write(USAGE + '\n'); process.exit(2); }
} catch (e) {
  process.stderr.write(`${e.message}\n`);
  process.exit(1);
}
