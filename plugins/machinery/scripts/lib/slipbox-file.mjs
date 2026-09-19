// Story: #132 § 6–7. The slip box commands' logic. intake.mjs parses the flags and calls these;
// each throws an Error whose message is the refusal the user reads.
import fs from 'node:fs';
import path from 'node:path';
import { pending, setDisposition } from './inbox.mjs';
import { slipboxPaths, stampToId } from './layout.mjs';
import { loadSlipbox, inForce } from './slipbox.mjs';
import { writeOnce, writeText, dictationNote, versionNote, placeEmbed, swapEmbed, dropEmbed, syncGenerated } from './slipbox-write.mjs';
import { unmigrated, describeUnmigrated } from './unmigrated.mjs';
import { commitPaths } from './commit.mjs';

const rel = (repo, abs) => path.relative(repo, abs).split(path.sep).join('/');

export function refuseUnmigrated(repo) {
  const u = unmigrated(repo);
  if (u.any) throw new Error(`refusing to file: this project is not migrated to the slip box — ${describeUnmigrated(u)}. Run intake.mjs migrate --plan <file> first`);
}

export function fileSpec({ repo, stamp, subsystems, topic, title, supersedes = [], versions = [] }) {
  refuseUnmigrated(repo);
  if (versions.length && versions.length !== supersedes.length) throw new Error('--version needs one file per --supersedes id, in the same order');
  const p = slipboxPaths(repo);
  const entry = pending(p.specInbox).find((e) => e.stamp === stamp);
  if (!entry) throw new Error(`no PENDING entry with stamp ${stamp} in ${rel(repo, p.specInbox)}`);
  const box = loadSlipbox(repo);
  const live = inForce(box);
  for (const s of supersedes) {
    if (!box.notes.has(s)) throw new Error(`--supersedes ${s}: no such note`);
    if (!live.has(s)) throw new Error(`--supersedes ${s}: that note is no longer in force — supersede its successor`);
    // A subsystem left out would lose the old note's embed with nothing placed in its stead.
    const missing = box.notes.get(s).subsystems.filter((x) => !subsystems.includes(x));
    if (missing.length) throw new Error(`--supersedes ${s}: that note is also in ${missing.join(', ')} — list every one of its subsystems in --subsystems`);
  }
  const id = stampToId(stamp);
  const partial = versions.length > 0;
  const vIds = versions.map((_, i) => `${id}-v${i ? i + 1 : ''}`);
  const created = [id, ...vIds].map((n) => path.join(p.notes, `${n}.md`));
  for (const f of created) if (fs.existsSync(f)) throw new Error(`refusing to overwrite ${rel(repo, f)}: a note is written once`);
  const versionTexts = versions.map((f) => fs.readFileSync(f, 'utf8'));
  writeOnce(created[0], dictationNote({ id, subsystems, supersedes: partial ? [] : supersedes, title, text: entry.text }));
  vIds.forEach((v, i) => writeOnce(created[i + 1], versionNote({ id: v, subsystems, supersedes: supersedes[i], from: id, text: versionTexts[i] })));

  const successor = new Map(supersedes.map((s, i) => [s, partial ? vIds[i] : id]));
  const placed = partial ? vIds : [id];
  const touched = new Set();
  const newSubs = [];
  for (const [sub, st] of box.structures) {
    let text = st.text;
    for (const [old, next] of successor) {
      const swapped = subsystems.includes(sub) && !text.includes(`![[${next}]]`) ? swapEmbed(text, old, next) : null;
      text = swapped ?? dropEmbed(text, old);
    }
    if (text !== st.text) { writeText(path.join(p.structure, `${sub}.md`), text); touched.add(sub); }
  }
  for (const sub of subsystems) {
    const file = path.join(p.structure, `${sub}.md`);
    const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (before === null) newSubs.push(sub);
    let text = before;
    for (const pid of placed) if (!(text ?? '').includes(`![[${pid}]]`)) text = placeEmbed(text, sub, { id: pid, topic });
    if (text !== before) { writeText(file, text); touched.add(sub); }
  }

  const generated = syncGenerated(repo, loadSlipbox(repo));
  setDisposition(p.specInbox, stamp, { state: 'FILED', detail: `filed → ${rel(repo, created[0])}` });
  const subject = `spec: ${title}`.slice(0, 72);
  const body = [
    entry.text, '',
    `Filed → ${rel(repo, created[0])}`,
    ...vIds.map((v, i) => `Version ${v} supersedes ${supersedes[i]}`),
    ...(!partial && supersedes.length ? [`Supersedes ${supersedes.join(', ')}`] : []),
    `Inbox entry ${stamp} (SPEC)`,
  ].join('\n');
  commitPaths(repo, [...created, ...[...touched].map((s) => path.join(p.structure, `${s}.md`)), ...generated, p.specInbox], `${subject}\n\n${body}`);
  return { id, vIds, newSubs, partial, versionTexts, subject };
}

export const regen = (repo) => syncGenerated(repo, loadSlipbox(repo));
