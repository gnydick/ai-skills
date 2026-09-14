import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INBOX, SPEC_INBOX, CORE, RULES_DIR, DOCS_DIR, SPECS_DIR, MACHINERY_DIR, GLOBAL_ISSUE_TRACKING, PROJECT_ISSUE_TRACKING } from './layout.mjs';

const home = () => process.env.MACHINERY_HOME || os.homedir();
export function pluginRoot() {
  return process.env.CLAUDE_PLUGIN_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
}
function userConfigFile() { return path.join(home(), '.claude', 'machinery.json'); }
function userConfig() {
  const f = userConfigFile();
  if (!fs.existsSync(f)) return {};
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { throw new Error(`machinery.json is not valid JSON: ${f} (${e.message})`); }
}
// The universal source is the plugin directory itself (recalibration decisions 1, 2): inbox.md and
// core.md sit in it, and a universal rule files into core.md or a bucket skill, never a rules/ dir.
// A machinery.json still naming the old key is refused by name rather than silently defaulted.
export function universalSource() {
  const c = userConfig();
  if (c.rulesSource !== undefined && c.pluginSource === undefined) {
    throw new Error(`${userConfigFile()}: "rulesSource" was replaced by "pluginSource" — set "pluginSource" to the plugin directory (the parent of the old rules directory)`);
  }
  return c.pluginSource ? path.resolve(c.pluginSource) : pluginRoot();
}
export const universalInbox = () => path.join(universalSource(), INBOX);
export const universalCore = () => path.join(universalSource(), CORE);
export const projectRules = (root) => path.join(root, '.claude', RULES_DIR);
// The two issue-tracking files (docs/superpowers/specs/2026-09-12-issue-tracking-config-design.md).
// Built here and nowhere else, so the installer that seeds them, the command that reads and records
// them, and intake that files one all address the same bytes.
export const globalIssueTracking = () => path.join(home(), '.claude', RULES_DIR, GLOBAL_ISSUE_TRACKING);
export const projectIssueTracking = (root) => path.join(projectRules(root), PROJECT_ISSUE_TRACKING);
export const projectInbox = (root) => path.join(root, '.claude', MACHINERY_DIR, INBOX);
// The spec layout, by symmetry with the rule layout (ticket #81, owner ruling 2026-09-07). The
// location is FIXED and known — there is no resolver, no config key and no per-project declaration,
// because there is nothing per-project to declare. See lib/layout.mjs for why that is not the
// fabricated default the design invariants forbid.
export const projectSpecs = (root) => path.join(root, DOCS_DIR, SPECS_DIR);
export const projectSpecInbox = (root) => path.join(root, '.claude', MACHINERY_DIR, SPEC_INBOX);
export function markers() { return JSON.parse(fs.readFileSync(path.join(pluginRoot(), 'markers.json'), 'utf8')); }
