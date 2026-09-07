import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES_INDEX, LEGACY_RULES_INDEX, SPEC_INDEX, INBOX, SPEC_INBOX, RULES_DIR, SPECS_DIR, MACHINERY_DIR, REGISTER_DIR } from './layout.mjs';

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
  return c.rulesSource ? path.resolve(c.rulesSource) : path.join(pluginRoot(), RULES_DIR);
}
export const universalInbox = () => path.join(path.dirname(rulesSource()), INBOX);
export const universalIndex = () => path.join(path.dirname(rulesSource()), REGISTER_DIR, RULES_INDEX);
export const projectRules = (root) => path.join(root, '.claude', RULES_DIR);
export const projectInbox = (root) => path.join(root, '.claude', MACHINERY_DIR, INBOX);
export const projectIndex = (root) => path.join(root, '.claude', MACHINERY_DIR, RULES_INDEX);
// Pre-#81 name, resolved only so the installer can migrate one and the gate can name the migration.
export const legacyProjectIndex = (root) => path.join(root, '.claude', MACHINERY_DIR, LEGACY_RULES_INDEX);
// The spec layout, by symmetry with the rule layout (ticket #81, owner ruling 2026-09-07). There is
// deliberately no fabricated fallback: a project with no .claude/specs has not declared a spec area,
// and that is reported, never guessed (rules/design-invariants.md § Absence and defaults).
export const projectSpecs = (root) => path.join(root, '.claude', SPECS_DIR);
export const projectSpecInbox = (root) => path.join(root, '.claude', MACHINERY_DIR, SPEC_INBOX);
export const projectSpecIndex = (root) => path.join(root, '.claude', MACHINERY_DIR, SPEC_INDEX);
export function markers() { return JSON.parse(fs.readFileSync(path.join(pluginRoot(), 'markers.json'), 'utf8')); }
