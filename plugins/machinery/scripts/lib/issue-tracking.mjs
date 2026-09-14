// Story: docs/superpowers/specs/2026-09-12-issue-tracking-config-design.md § Precedence (Ruling G).
// The precedence table as a function the assistant runs, through scripts/issue-tracking.mjs, to decide
// whether to begin the setup conversation. It reads nothing but the text it is handed, writes nothing,
// detects nothing and asks nothing. Paths are built in lib/config.mjs; the state words come from
// lib/layout.mjs and are never spelled here.
import fs from 'node:fs';
import { UNANSWERED, NONE } from './layout.mjs';
import { parseInbox } from './inbox.mjs';

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

// The one validator for a recorded answer, shared by record-global, record-project and intake. An empty
// answer and the seeded word would each record the UNANSWERED state.
export function normalizeAnswer(raw) {
  const text = String(raw ?? '').replace(/\r\n/g, '\n').trim();
  if (text === '') throw new Error(`an empty answer is read as ${UNANSWERED}, so recording it records nothing`);
  if (text === UNANSWERED) throw new Error(`${UNANSWERED} is the seeded word, not an answer`);
  return text;
}

// The project answer's inbox entry (Ruling F; the plan's Decision 1). PROJECT_ENTRY_KIND is the kind
// lib/inbox.mjs's heading pattern accepts for a project rule; a mismatch is not silent here, because
// record-project reads every entry back through that parser and fails unless it finds exactly one.
export const PROJECT_ENTRY_KIND = 'PRULE';
// A rule ruled in conversation without the marker is "written into the inbox by hand, with a note
// saying why the automatic capture did not fire."
export const CAPTURE_NOTE = 'Note: automatic capture did not fire. This answer was given in plain words in the issue-tracking setup conversation, which asks for no mark, and was recorded by issue-tracking.mjs record-project.';
export const entryText = (answer) => `${answer}\n\n${CAPTURE_NOTE}`;

export function findRecorded(inboxText, { stamp, session, text }) {
  return parseInbox(inboxText).filter((e) => e.state === 'PENDING' && e.disposition === 'PENDING'
    && e.marker === PROJECT_ENTRY_KIND && e.stamp === stamp && e.session === session && e.text === text);
}

export const pendingIssueTracking = (inboxText) => parseInbox(inboxText).filter((e) => e.state === 'PENDING' && e.text.endsWith(CAPTURE_NOTE));
