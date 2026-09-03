#!/usr/bin/env node
// Story: hooks/quiet-output.md steps 1–18 (the hook half). Fails OPEN (spec I17).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify } from './lib/classify.mjs';
import { readPayload } from './lib/stdin.mjs';
import { updatedInput } from './lib/emit.mjs';

function main() {
  const p = readPayload();
  if (!p) return;
  const tool = p.tool_name;
  if (tool !== 'Bash' && tool !== 'PowerShell') return;
  const input = p.tool_input ?? {};
  const command = input.command ?? '';
  const kind = classify(command);
  if (kind !== 'infra' && kind !== 'noisy') return;
  const mode = kind === 'infra' ? 'infra' : 'filter';
  const shell = tool === 'PowerShell' ? 'powershell' : 'bash';
  const job = process.env.CLAUDE_JOB_DIR;
  const dir = job ? path.join(job, 'tmp') : path.join(os.tmpdir(), 'claude-quiet');
  fs.mkdirSync(dir, { recursive: true });
  const cmdfile = path.join(dir, `cmd-${process.pid}-${Date.now()}.txt`);
  fs.writeFileSync(cmdfile, command, 'utf8');
  let runner = path.join(path.dirname(fileURLToPath(import.meta.url)), 'quiet-run.mjs');
  let file = cmdfile;
  if (shell === 'bash') { runner = runner.replace(/\\/g, '/'); file = file.replace(/\\/g, '/'); }
  const wrapped = shell === 'bash'
    ? `node "${runner}" --shell bash --mode ${mode} "${file}"`
    : `node "${runner}" --shell powershell --mode ${mode} "${file}"; exit $LASTEXITCODE`;
  updatedInput({ ...input, command: wrapped, description: `${input.description ?? ''} [quiet:${mode}]`.trim() });
}

try { main(); } catch { /* fail open: the command runs unfiltered */ }
process.exitCode = 0;
