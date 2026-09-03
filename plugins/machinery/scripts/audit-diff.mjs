#!/usr/bin/env node
// Story: claude-code/machinery/invariant-audit/SKILL.md step 1. Makes handing
// the invariant-auditor agent a diff mechanical: it cannot run commands, edit
// or write (agents/invariant-auditor.md), so this script produces the exact
// two things it needs — the diff text and the changed-file list — and hands
// both back on stdout. Fails CLOSED: not a repo, base == HEAD (nothing real
// to diff against), or an empty diff all write no file and exit non-zero.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { git, gitRaw } from './lib/git.mjs';
import { projectRoot } from './lib/root.mjs';
import { baseRef } from './lib/base-ref.mjs';

const fail = (msg) => { process.stderr.write(`audit-diff: ${msg}\n`); process.exit(1); };
const opt = (name) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; };

const cwd = process.cwd();

// projectRoot resolves to the MAIN checkout even from inside a linked
// worktree (lib/root.mjs) — that is what we want here, since
// .claude/settings.json's worktree.baseRef policy is a project-wide setting,
// not a per-worktree one, and origin/HEAD is the same ref no matter which
// worktree asks. The current branch and the diff itself, below, deliberately
// run against `cwd` instead — the worktree actually being audited — because
// HEAD is per-worktree and projectRoot's main-checkout HEAD would silently
// diff the wrong branch.
let repoRoot;
try { repoRoot = projectRoot(cwd); } catch (e) { fail(e.message); }

const branchResult = git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
if (branchResult.code !== 0 || !branchResult.stdout) fail(`could not resolve the current branch in ${cwd}`);
const branch = branchResult.stdout;

const base = baseRef(repoRoot);
if (base === 'HEAD') fail('resolved base is the literal HEAD — no origin/HEAD and no worktree.baseRef override, so there is nothing real to diff against');

const diffResult = gitRaw(['diff', `${base}...HEAD`], cwd);
if (diffResult.code !== 0) fail(`git diff ${base}...HEAD failed: ${diffResult.stderr}`);
if (!diffResult.stdout.trim()) fail(`diff of ${branch} against ${base} is empty — nothing to audit`);

const namesResult = git(['diff', '--name-only', `${base}...HEAD`], cwd);
const files = namesResult.stdout.split('\n').filter(Boolean);

const outArg = opt('--out');
const outPath = outArg ? path.resolve(outArg) : path.join(os.tmpdir(), 'machinery-audit', `${branch}.diff`);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, diffResult.stdout, 'utf8');

process.stdout.write(outPath + '\n');
for (const f of files) process.stdout.write(f + '\n');
