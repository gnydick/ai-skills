#!/usr/bin/env node
// SessionStart and SubagentStart: inject core.md as additionalContext (recalibration decision 21).
import fs from 'node:fs';
import path from 'node:path';
import { readPayload } from './lib/stdin.mjs';
import { context } from './lib/emit.mjs';
import { pluginRoot } from './lib/config.mjs';

const event = readPayload()?.hook_event_name === 'SubagentStart' ? 'SubagentStart' : 'SessionStart';
const file = path.join(pluginRoot(), 'core.md');
let text;
try { text = fs.readFileSync(file, 'utf8'); }
catch (e) {
  process.stderr.write(`machinery core: cannot read ${file} (${e.code ?? e.message}) — reinstall: claude plugin install machinery@ai-skills --scope project\n`);
  process.exit(1);
}
context(text, event);
