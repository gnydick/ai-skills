// Story: #132 § 9. The slip box's commit gate: a dictation note is verbatim, each structure note
// holds exactly the notes in force, every link resolves, the generated pages are fresh, and no
// note has two successors. Read-only (spec I23). Legs 1 and 7, which read the staged diff, are
// added by the next change.
import fs from 'node:fs';
import path from 'node:path';
import { report } from '../lib/report.mjs';
import { parseInbox } from '../lib/inbox.mjs';
import { unquote } from '../lib/blockquote.mjs';
import { links, section } from '../lib/embed.mjs';
import { idToStamp } from '../lib/layout.mjs';
import { loadSlipbox, inForce, expected, subsystemsOf, readStructure, regenerate, staleGenerated, dictationQuote, isSupersededDecision } from '../lib/slipbox.mjs';

export const declaration = Object.freeze({ id: 'slipbox_check', run: 'slipboxCheck', blocking: true, wired: true });

export function slipboxCheck({ root, specInbox }) {
  const box = loadSlipbox(root);
  const live = inForce(box);
  let ok = true;
  const leg = (bad, of, note, lines) => {
    report('slipbox_check', bad, of, note);
    for (const l of lines) process.stdout.write(`commit refused: ${l}\n`);
    if (lines.length) ok = false;
  };

  // Leg 2 — verbatim. Every file under notes/ is a dictation or version note, and a dictation note
  // quotes its FILED inbox entry byte for byte.
  const entries = fs.existsSync(specInbox) ? parseInbox(fs.readFileSync(specInbox, 'utf8')) : [];
  const filed = new Map(entries.filter((e) => e.state === 'FILED').map((e) => [e.stamp, e.text]));
  const inNotes = [...box.notes.values()].filter((n) => n.rel.startsWith(path.relative(root, box.paths.notes).split(path.sep).join('/') + '/'));
  const verbatim = inNotes.flatMap((n) => {
    if (n.kind === 'version') return [];
    if (n.kind !== 'dictation') return [`${n.rel} is under notes/ but is neither a dictation nor a version note${n.error ? ` (${n.error})` : ''}`];
    const want = filed.get(idToStamp(n.id));
    if (want === undefined) return [`${n.rel} has no FILED spec-inbox entry with stamp ${idToStamp(n.id)} — a dictation note is written only by intake.mjs spec`];
    let got = null;
    try { const q = dictationQuote(n.body); got = q === null ? null : unquote(q); } catch {}
    return got === want ? [] : [`${n.rel} does not quote its inbox entry ${idToStamp(n.id)} byte for byte — restore it from the inbox; a dictation note is never edited`];
  });
  leg(verbatim.length, inNotes.filter((n) => n.kind !== 'version').length, 'dictation note(s) not verbatim (must be 0)', verbatim);

  // Leg 3 — membership (#132 § 5).
  const why = (id) => {
    const n = box.notes.get(id);
    if (!n) return 'not a note';
    if (['map', 'plan'].includes(n.kind)) return `a ${n.kind}, never embedded`;
    return live.has(id) ? 'not an in-force note of this subsystem' : 'superseded or consumed';
  };
  const subs = subsystemsOf(box, live);
  const member = [];
  let badSubs = 0;
  for (const s of subs) {
    const before = member.length;
    const st = box.structures.get(s);
    const want = expected(box, s, live);
    if (!st) { member.push(`subsystem '${s}' has in-force notes but no structure note — file through intake.mjs, which creates it`); badSubs++; continue; }
    const have = readStructure(st.text);
    for (const id of have.embeds.filter((x) => !want.embeds.includes(x))) member.push(`${st.rel} embeds ${id}, which is ${why(id)} — embed the note in force instead`);
    for (const id of want.embeds.filter((x) => !have.embeds.includes(x))) member.push(`${st.rel} is missing the in-force note ${id}`);
    for (const h of have.headingEmbeds.filter((x) => !want.designs.includes(x.id))) member.push(`${st.rel} embeds ${h.id}#${h.heading}, which is ${why(h.id)} — only an approved, in-force design note is embedded by heading`);
    for (const id of want.designs.filter((x) => !have.headingEmbeds.some((h) => h.id === x))) member.push(`${st.rel} embeds no heading of the approved design note ${id} — run intake.mjs design --embed`);
    for (const id of have.why.filter((x) => { const n = box.notes.get(x); return n && isSupersededDecision(n); })) member.push(`${st.rel} links ${id} under "Why it is this way", but that decision is superseded — run intake.mjs decision --file on its successor`);
    for (const id of want.decisions.filter((x) => !have.why.includes(x))) member.push(`${st.rel} does not link the decision ${id} — run intake.mjs decision --file`);
    if (member.length > before) badSubs++;
  }
  leg(badSubs, subs.length, 'subsystem(s) with wrong membership (must be 0)', member);

  // Leg 4 — links resolve, headings exist, references exist.
  const specsRel = path.relative(root, box.paths.specs).split(path.sep).join('/') + '/';
  const texts = [
    ...[...box.notes.values()].filter((n) => n.rel.startsWith(specsRel)).map((n) => [n.rel, n.body]),
    ...[...box.structures.values()].map((s) => [s.rel, s.text]),
  ];
  const broken = [];
  const badFiles = new Set();
  for (const [rel, text] of texts) {
    for (const l of links(text)) {
      const t = box.notes.get(l.id);
      if (!t) { broken.push(`${rel} links [[${l.id}]], which does not exist`); badFiles.add(rel); }
      else if (l.heading && section(t.body, l.heading) === null) { broken.push(`${rel} links [[${l.id}#${l.heading}]], but ${t.rel} has no heading '${l.heading}'`); badFiles.add(rel); }
    }
  }
  for (const s of box.structures.values()) {
    for (const href of readStructure(s.text).refs) {
      if (/^([a-z][a-z0-9+.-]*:|#)/i.test(href) || fs.existsSync(path.join(root, path.dirname(s.rel), href))) continue;
      broken.push(`${s.rel} references ${href}, which does not exist`); badFiles.add(s.rel);
    }
  }
  leg(badFiles.size, texts.length, 'file(s) with broken links (must be 0)', broken);

  // Leg 5 — generated pages are fresh. Compared in memory; the gate never writes.
  let want = new Map();
  const stale = [];
  try { want = regenerate(box); } catch (e) { stale.push(`the current state cannot be generated — ${e.message}`); }
  for (const [rel, text] of want) {
    const abs = path.join(root, rel);
    const cur = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
    if (cur !== text) stale.push(`${rel} is ${cur === null ? 'missing' : 'stale'} — run intake.mjs regen`);
  }
  for (const rel of staleGenerated(box, want)) stale.push(`${rel} has no structure note behind it — run intake.mjs regen`);
  leg(stale.length, want.size, 'generated page(s) stale (must be 0)', stale);

  // Leg 6 — no fork: each note has at most one successor.
  const by = new Map();
  for (const n of box.notes.values()) for (const s of n.supersedes) by.set(s, [...(by.get(s) ?? []), n.id]);
  const forks = [...by].filter(([, v]) => v.length > 1).map(([s, v]) => `${s} is superseded by ${v.length} notes (${v.join(', ')}) — the later one must supersede ${v[0]} instead`);
  leg(forks.length, by.size, 'superseded note(s) with a fork (must be 0)', forks);

  return ok;
}
