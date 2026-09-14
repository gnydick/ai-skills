#!/usr/bin/env node
// /machinery:reload — puts core.md (and, with --project, the project's .claude/rules/) into the
// running session's context (recalibration 21, 37). Prints only what changed since this session
// last reloaded (#65); `--all` forces the full dump. `--scratchpad <dir>` is where the session's
// own manifest lives; without it there is nothing to compare against and the run says so. The
// delta itself is lib/reload.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { universalCore, projectRules } from './lib/config.mjs';
import { projectRoot } from './lib/root.mjs';
import { reloadDelta, MANIFEST_NAME } from './lib/reload.mjs';

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };

const sources = [['core.md', universalCore()]];
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
