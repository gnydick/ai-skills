// Story: docs/superpowers/specs/2026-09-12-issue-tracking-config-design.md § Precedence (Ruling G).
// The precedence table as a function the assistant runs, through scripts/issue-tracking.mjs, to decide
// whether to begin the setup conversation. It reads nothing but the text it is handed, writes nothing,
// detects nothing and asks nothing. Paths are built in lib/config.mjs; the state words come from
// lib/layout.mjs and are never spelled here.
import fs from 'node:fs';
import { UNANSWERED, NONE } from './layout.mjs';

// What one file holds, as the table reads it. ABSENT is the file system's condition, kept apart from
// the three contents because "absent defers to the global file, empty does not".
export const ABSENT = 'absent';
export const NO_ANSWER = 'no-answer';
export const DECLINED = 'declined';
export const ANSWERED = 'answered';

// Compared after trim(): an empty file is read as unanswered (Ruling H), and whitespace-only counts as
// empty (this plan, settling the spec's observation 6 — the seed itself ends with a newline).
export function fileState(contents) {
  if (contents === null) return ABSENT;
  const text = contents.trim();
  if (text === '' || text === UNANSWERED) return NO_ANSWER;
  if (text === NONE) return DECLINED;
  return ANSWERED;
}

const carriesAnswer = (state) => state === DECLINED || state === ANSWERED;

// The project file decides whenever it exists (Ruling B). A global answer never silences a project
// whose own file carries no answer (Rulings B and D); it is that project's pre-fill instead.
export function decide({ project, global: globalContents }) {
  const projectState = fileState(project);
  const globalState = fileState(globalContents);
  if (projectState === ABSENT) return { ask: !carriesAnswer(globalState), prefill: null };
  if (carriesAnswer(projectState)) return { ask: false, prefill: null };
  return { ask: true, prefill: carriesAnswer(globalState) ? globalContents.trim() : null };
}

// A missing file is data (the absent rows of the table); anything else that stops the read is not,
// and is thrown so the caller reports it rather than deciding on a file it never saw.
export function readIfPresent(file) {
  try { return fs.readFileSync(file, 'utf8'); }
  catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}
