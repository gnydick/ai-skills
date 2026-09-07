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
import { markers, projectInbox, universalInbox, projectSpecInbox, projectSpecs } from './lib/config.mjs';
import { projectRoot, isRootSession } from './lib/root.mjs';
import { appendEntry, pending } from './lib/inbox.mjs';

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
    lines.push(`URULE captured verbatim to ${inbox} (PENDING). Run the intake sequence now (skill: machinery:rule-intake): file it in the universal rules, regenerate the index, bump the plugin version, disposition the entry, commit, then /machinery:reload.`);
  } else if (head.startsWith(m.project.toLowerCase())) {
    const inbox = projectInbox(root);
    appendEntry(inbox, { marker: 'PRULE', text: prompt, session });
    lines.push(rootSession
      ? `PRULE captured verbatim to ${inbox} (PENDING). Run the intake sequence now (skill: machinery:rule-intake): file it in this project's rules, regenerate the index, disposition the entry, commit. Commits are blocked until then.`
      : `PRULE captured verbatim to the project root's inbox ${inbox} (PENDING). This session is inside an isolated working copy, so it will be filed from a root session; the root's commits stay blocked until then.`);
  } else if (head.startsWith(m.spec.toLowerCase())) {
    const inbox = projectSpecInbox(root);
    appendEntry(inbox, { marker: 'SPEC', text: prompt, session });
    const specs = projectSpecs(root);
    lines.push(rootSession
      ? `SPEC captured verbatim to ${inbox} (PENDING). Run the spec intake now (skill: machinery:spec-intake): file it into the specification under ${specs} that owns the subsystem, regenerate SPEC_INDEX.md, disposition the entry, commit. Commits are blocked until then.`
      : `SPEC captured verbatim to the project root's spec inbox ${inbox} (PENDING). This session is inside an isolated working copy, so it will be filed from a root session; the root's commits stay blocked until then.`);
  } else if (head.startsWith(m.ambiguous.toLowerCase())) {
    lines.push(`Ambiguous marker: nothing was captured. Dictate a project rule with ${m.project} or a universal rule with ${m.universal}.`);
  }

  const proj = rootSession ? pending(projectInbox(root)).length : 0;
  const univ = pending(universalInbox()).length;
  const n = proj + univ;
  if (n && !lines.some((l) => l.includes('Run the intake sequence now'))) {
    lines.unshift(`${n} rule${n === 1 ? '' : 's'} pending in the inbox${proj && univ ? 'es' : ''} — running intake (skill: machinery:rule-intake) before this prompt.`);
  }
  const specs = rootSession ? pending(projectSpecInbox(root)).length : 0;
  if (specs && !lines.some((l) => l.includes('Run the spec intake now'))) {
    lines.unshift(`${specs} specification${specs === 1 ? '' : 's'} pending in the spec inbox — running the spec intake (skill: machinery:spec-intake) before this prompt.`);
  }
  if (lines.length) context(lines.join('\n'));
  return 0;
}

try { process.exitCode = main(); }
catch (e) { process.stderr.write(`rule capture failed (inbox not written): ${e.message}\n`); process.exitCode = 1; }
