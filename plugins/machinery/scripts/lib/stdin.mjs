import fs from 'node:fs';
export function readPayload() {
  try { return JSON.parse(fs.readFileSync(0, 'utf8')); } catch { return null; }
}
