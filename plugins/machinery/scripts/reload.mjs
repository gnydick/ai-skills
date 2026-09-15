#!/usr/bin/env node
// /machinery:reload — puts the user's ~/.claude/rules/universal.md (and, with --project, the
// project's .claude/rules/) into the running session's context (recalibration 38; STATUS 54). That
// is the file a URULE filing changes mid-session; core.md is the plugin's, injected at session start
// and changed only with the plugin, so it is not reloaded. Prints only what changed since this
// session last reloaded (#65); `--all` forces the full dump. `--scratchpad <dir>` is where the
// session's own manifest lives; without it there is nothing to compare against and the run says
// so. A missing universal.md is named on the output, never skipped. The delta itself is
// lib/reload.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { universalRules, projectRules } from './lib/config.mjs';
import { projectRoot } from './lib/root.mjs';
import { reloadDelta, MANIFEST_NAME } from './lib/reload.mjs';

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };

const sources = [['~/.claude/rules/universal.md', universalRules()]];
if (argv.includes('--project')) { try { sources.push(['.claude/rules', projectRules(projectRoot(process.cwd()))]); } catch {} }

const scratchpad = opt('--scratchpad');
const manifestPath = scratchpad ? path.join(path.resolve(scratchpad), MANIFEST_NAME) : null;

// A SYNCHRONOUS write, so "the manifest is written only after a successful print" is a fact the
// program can act on: process.stdout.write buffers and reports failure later, by which time the
// manifest would already be on disk. Loops because writeSync may write fewer bytes than asked.
function writeOut(text) {
  const buf = Buffer.from(text, 'utf8');
  let off = 0;
  while (off < buf.length) off += fs.writeSync(1, buf, off, buf.length - off);
}

reloadDelta({ sources, manifestPath, all: argv.includes('--all'), write: writeOut });
