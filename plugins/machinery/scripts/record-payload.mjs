// Dev-only. When MACHINERY_RECORD is set to a directory, writes each hook
// payload it receives to <dir>/<event>[-<tool>].json. Prints nothing.
import fs from 'node:fs';
import path from 'node:path';
import { readPayload } from './lib/stdin.mjs';
const dir = process.env.MACHINERY_RECORD;
const p = readPayload();
if (dir && p) {
  const name = [p.hook_event_name, p.tool_name].filter(Boolean).join('-');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(p, null, 2) + '\n');
}
