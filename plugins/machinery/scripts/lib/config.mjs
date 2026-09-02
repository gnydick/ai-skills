import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const home = () => process.env.MACHINERY_HOME || os.homedir();
export function pluginRoot() {
  return process.env.CLAUDE_PLUGIN_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
}
function userConfig() {
  const f = path.join(home(), '.claude', 'machinery.json');
  if (!fs.existsSync(f)) return {};
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { throw new Error(`machinery.json is not valid JSON: ${f} (${e.message})`); }
}
export function rulesSource() {
  const c = userConfig();
  return c.rulesSource ? path.resolve(c.rulesSource) : path.join(pluginRoot(), 'rules');
}
export const universalInbox = () => path.join(path.dirname(rulesSource()), 'inbox.md');
export const universalIndex = () => path.join(path.dirname(rulesSource()), 'register', 'INDEX.md');
export const projectRules = (root) => path.join(root, '.claude', 'rules');
export const projectInbox = (root) => path.join(root, '.claude', 'machinery', 'inbox.md');
export const projectIndex = (root) => path.join(root, '.claude', 'machinery', 'INDEX.md');
export function markers() { return JSON.parse(fs.readFileSync(path.join(pluginRoot(), 'markers.json'), 'utf8')); }
