#!/usr/bin/env node
// Story: hooks/quiet-output.md steps 1–18 (the hook half). Fails OPEN (spec I17).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify, isNever } from './lib/classify.mjs';
import { readPayload } from './lib/stdin.mjs';
import { updatedInput } from './lib/emit.mjs';
import { projectRoot } from './lib/root.mjs';
import { loadCatalog } from './lib/catalog.mjs';
import { loadObservations } from './lib/observations.mjs';
import { decide } from './lib/assimilate.mjs';

// classify() says 'plain' about three things: a command it simply does not recognise, whose volume
// is UNKNOWN rather than quiet (specs/2026-09-04-tool-assimilation-design.md, "The default is also
// backwards"); a command the catalog knows, which the catalog — not the regexes — is the authority
// on (ruling I1, 2026-09-05); and one the NEVER list exempts outright. Only the first two are the
// assimilator's business. Returns the wrap mode, or null for "leave this command alone".
function assimilated(command, { root, catalog }) {
  if (isNever(command)) return null;
  const d = decide(command, { catalog, observations: loadObservations(root) });
  if (d.mode === 'plain') return null;              // seen here, and it was quiet
  return d.mode === 'noisy' ? 'filter' : d.mode;    // 'filter' | 'observe' | 'suggest'
}

function main() {
  const p = readPayload();
  if (!p) return;
  const tool = p.tool_name;
  if (tool !== 'Bash' && tool !== 'PowerShell') return;
  const input = p.tool_input ?? {};
  const command = input.command ?? '';
  // The project root and its catalog, resolved ONCE and handed to both readers below. Outside a
  // repository there is no project half to overlay and no record to keep, so the catalog is empty
  // and the assimilator is not consulted — the regex chain alone answers, as it always did there.
  // That is the one throw swallowed here on purpose; anything else reaches the catch at the bottom.
  let root = null;
  try { root = projectRoot(process.cwd()); } catch { /* not inside a repository */ }
  const catalog = root ? loadCatalog(root) : {};
  const kind = classify(command, { catalog });
  let mode = kind === 'infra' ? 'infra' : kind === 'noisy' ? 'filter' : null;
  if (!mode && kind === 'plain' && root) mode = assimilated(command, { root, catalog });
  if (!mode) return;
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
