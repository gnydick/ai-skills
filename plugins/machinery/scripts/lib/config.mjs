import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INBOX, SPEC_INBOX, RULES_DIR, DOCS_DIR, SPECS_DIR, MACHINERY_DIR, GLOBAL_ISSUE_TRACKING, PROJECT_ISSUE_TRACKING, userHome, userInbox, userRules } from './layout.mjs';

export function pluginRoot() {
  return process.env.CLAUDE_PLUGIN_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
}
// The universal inbox and the universal rules are the USER's (STATUS 54), spelled once in
// lib/layout.mjs beside the gate's own reader of the same paths. There is no user-level
// configuration: a stray ~/.claude/machinery.json (the retired pluginSource/rulesSource file) is
// not read by anything.
export const universalInbox = () => userInbox(userHome());
export const universalRules = () => userRules(userHome());
export const projectRules = (root) => path.join(root, '.claude', RULES_DIR);
// The two issue-tracking files (docs/superpowers/specs/2026-09-12-issue-tracking-config-design.md).
// Built here and nowhere else, so the installer that seeds them, the command that reads and records
// them, and intake that files one all address the same bytes.
export const globalIssueTracking = () => path.join(userHome(), '.claude', RULES_DIR, GLOBAL_ISSUE_TRACKING);
export const projectIssueTracking = (root) => path.join(projectRules(root), PROJECT_ISSUE_TRACKING);
export const projectInbox = (root) => path.join(root, '.claude', MACHINERY_DIR, INBOX);
// The spec layout, by symmetry with the rule layout (ticket #81, owner ruling 2026-09-07). The
// location is FIXED and known — there is no resolver, no config key and no per-project declaration,
// because there is nothing per-project to declare. See lib/layout.mjs for why that is not the
// fabricated default the design invariants forbid.
export const projectSpecs = (root) => path.join(root, DOCS_DIR, SPECS_DIR);
export const projectSpecInbox = (root) => path.join(root, '.claude', MACHINERY_DIR, SPEC_INBOX);
export function markers() { return JSON.parse(fs.readFileSync(path.join(pluginRoot(), 'markers.json'), 'utf8')); }
