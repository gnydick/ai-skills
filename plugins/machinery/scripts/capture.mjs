#!/usr/bin/env node
// Story: hooks/rule-capture.md. Fails LOUD (spec §Claude-side): a rule you dictated and lost is the worst outcome.
//
// #81 adds the SPEC: mark on exactly the same terms (owner ruling, 2026-09-07). A specification
// dictated with SPEC: used to fall through to the ambiguous branch and be written nowhere at all, so
// a session that ignored it or died part-way lost the text outright — the precise failure this hook
// exists to prevent for rules. Capture makes the TEXT durable; the LOCATION it names is fixed and
// known (owner, 2026-09-07: "we just need a unique location to persist those specs"), so there is
// nothing here to resolve, declare, or get wrong.
import { readPayload } from './lib/stdin.mjs';
import { context } from './lib/emit.mjs';
import { markers, projectInbox, universalInbox, projectSpecInbox } from './lib/config.mjs';
import { projectRoot, isRootSession } from './lib/root.mjs';
import { appendEntry, pending } from './lib/inbox.mjs';

// One message shape for every mark, naming the one fix (recalibration decision 3). From inside an
// isolated working copy the entry lands in the ROOT's inbox and is filed from there (spec I20, I29).
const captured = (mark, inbox, rootSession, root) => (rootSession
  ? `${mark} captured verbatim to ${inbox} (PENDING). Commits are refused until it is filed: run /machinery:rule-process.`
  : `${mark} captured verbatim to ${inbox} (PENDING). Commits in ${root} are refused until it is filed: run /machinery:rule-process from ${root}.`);

function main() {
  const p = readPayload();
  if (!p) return 0;
  const cwd = p.cwd || process.cwd();
  const m = markers();
  const prompt = String(p.prompt ?? '');
  const head = prompt.trimStart().toLowerCase();
  const session = p.session_id || 'unknown-session';
  const root = projectRoot(cwd);
  const rootSession = isRootSession(cwd);
  const lines = [];

  if (head.startsWith(m.universal.toLowerCase())) {
    const inbox = universalInbox();
    appendEntry(inbox, { marker: 'URULE', text: prompt, session });
    lines.push(captured('URULE', inbox, true, root));
  } else if (head.startsWith(m.project.toLowerCase())) {
    const inbox = projectInbox(root);
    appendEntry(inbox, { marker: 'PRULE', text: prompt, session });
    lines.push(captured('PRULE', inbox, rootSession, root));
  } else if (head.startsWith(m.spec.toLowerCase())) {
    const inbox = projectSpecInbox(root);
    appendEntry(inbox, { marker: 'SPEC', text: prompt, session });
    lines.push(captured('SPEC', inbox, rootSession, root));
  } else if (head.startsWith(m.ambiguous.toLowerCase())) {
    lines.push(`Ambiguous marker: nothing was captured. Dictate a project rule with ${m.project} or a universal rule with ${m.universal}.`);
  }

  // A capture line already names the fix; the nudge is for a prompt that captured nothing.
  const justCaptured = lines.some((l) => l.includes('captured verbatim'));
  const proj = rootSession ? pending(projectInbox(root)).length : 0;
  const univ = pending(universalInbox()).length;
  const n = proj + univ;
  if (n && !justCaptured) {
    lines.unshift(`${n} rule${n === 1 ? '' : 's'} pending in the inbox — run /machinery:rule-process before this prompt.`);
  }
  const specs = rootSession ? pending(projectSpecInbox(root)).length : 0;
  if (specs && !justCaptured) {
    lines.unshift(`${specs} specification${specs === 1 ? '' : 's'} pending in the spec inbox — run /machinery:rule-process before this prompt.`);
  }
  if (lines.length) context(lines.join('\n'));
  return 0;
}

try { process.exitCode = main(); }
catch (e) { process.stderr.write(`rule capture failed (inbox not written): ${e.message}\n`); process.exitCode = 1; }
