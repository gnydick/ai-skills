#!/usr/bin/env node
// Assembles docs/learnings/recalibration-2026-09/decision-consequences.md from the workflow's output.
//
// The per-decision detail is assembled HERE rather than written by a model, deliberately: the owner is
// deciding whether he still agrees with retiring an exact sentence, and a summarised quote is useless
// for that. Only the opening section is model-written; everything under it is mechanical.
//
// Usage: node docs/learnings/recalibration-2026-09/build-decision-digest.mjs <workflow-output.json> [out.md]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [, , src, outArg] = process.argv;
if (!src) { process.stderr.write('usage: build-decision-digest.mjs <workflow-output.json> [out.md]\n'); process.exit(2); }

// Lives beside its input and its output, like csv-index.mjs in this same directory: an artifact of
// the 2026-09 recalibration, not repository tooling.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const out = outArg ?? path.join(HERE, 'decision-consequences.md');
const result = JSON.parse(fs.readFileSync(src, 'utf8')).result;

// The one retired row whose `decision` cell is neither a number nor one of the four named rulings, so
// the run's batching could not reach it. Carried by hand rather than left out: a digest that quotes
// 165 of 166 retirements has the same shape of hole this whole campaign was about.
const UNBATCHED = {
  decision: 'developer-friendliness tabled; machinery no longer depends on it (0.1.114)',
  text: 'Not a numbered principle decision and not one of the named Owner rulings — a free-text cell in the ledger, recorded when developer-friendliness was tabled.',
  amended: 'NONE',
  rowsCiting: 1,
  byDisposition: 'dropped 1',
  whatWasGivenUp: 'The requirement to search the developer-friendliness skill before filing a rule, so a rule duplicating that skill is closed with a pointer rather than filed into machinery.',
  worthReview: false,
  worthReviewWhy: 'The dependency it governed is gone. Recorded for completeness of the retirement count, not as a candidate for restoration.',
  retired: [{
    id: 'M153',
    disposition: 'dropped',
    destination: 'NONE',
    rule: '- Before a new rule is filed, search the developer-friendliness skill for it as\n  well as the rule groups. If the skill already asks for the same action for the\n  same reason, the rule is not filed into machinery, and its inbox entry is\n  closed with a pointer to the skill section that covers it. If the rule\n  contradicts the skill, it goes to the owner for a ruling before it is filed.\n  Duplicates never live in machinery: where both say the same thing, the skill\n  keeps it. (Gabe, 2026-09-10, URULE.)',
  }],
  changedRequirement: [],
  evidence: 'Found by diffing the digest\'s quoted ids against every parked/dropped row in disposition.csv: 166 retired rows, 165 quoted.',
};

// Rulings the owner has since made on a flagged decision. Kept here rather than hand-edited into the
// output so a regeneration cannot quietly drop them — a digest that still says "worth a second look"
// after the look happened is the same stale-record failure this whole campaign was about.
const RESOLVED = {
  24: {
    date: '2026-09-16',
    ruling: 'Stands as written. The file stays parked with unbreakable, all 46 rules, including the 18 that are not invariant theory.',
    detail: 'Raised as #126 after the digest flagged it: 18 of the 46 were about how code behaves toward its user and its inputs rather than about invariants, and four sites in shipped machinery code were following them by hand from code comments. The owner considered splitting the park and declined. Not reopened without a new ruling.',
  },
};

const decisions = [...result.decisions, UNBATCHED];
const quoted = new Set();
for (const d of decisions) for (const r of d.retired ?? []) quoted.add(r.id);

const resolvedFor = (d) => RESOLVED[String(d.decision)] ?? RESOLVED[Number(d.decision)];
const weight = (d) => (d.retired?.length ?? 0) * 1000 + (d.rowsCiting ?? 0);
// A resolved decision leaves the flagged list. It is still flagged in the data — the run that found it
// was not wrong — but it is no longer something the owner owes an answer on, and a list of open
// questions that includes closed ones stops being read.
const flagged = decisions.filter((d) => d.worthReview && !resolvedFor(d)).sort((a, b) => weight(b) - weight(a));
const rest = decisions.filter((d) => !d.worthReview || resolvedFor(d)).sort((a, b) => weight(b) - weight(a));

const quote = (s) => String(s ?? '').trim().split('\n').map((l) => `> ${l.replace(/^\s+/, '')}`).join('\n');
const lines = [];

lines.push('# What each recalibration decision actually retired');
lines.push('');
lines.push('Four audit passes verified that what shipped matches its sources and that every retirement was');
lines.push('**authorized** by a dated decision. None asked whether the decisions were right — they took a dated');
lines.push('decision as authorization and stopped. That is not a gap an audit can close: only the owner can say a');
lines.push('decision was wrong, and he already found one that was. Decision (8) narrowed the ticket-companion rule,');
lines.push('survived two audits, and was ruled an accident on 2026-09-16.');
lines.push('');
lines.push('This digest exists so that judgement is a skim rather than an archaeology exercise. Every retired rule');
lines.push('is quoted **in full and verbatim**, because the question is whether that exact sentence should still be');
lines.push('gone. Assembled mechanically from the ledger; only the opening section below is written by a model.');
lines.push('');
const resolvedCount = decisions.filter(resolvedFor).length;
lines.push(`Generated from workflow \`wf_3fbeda61-95a\`. **${decisions.length} decisions traced, ${quoted.size} of 166 retired rules quoted, ${flagged.length} still flagged`
  + `${resolvedCount ? `, ${resolvedCount} ruled on since` : ''}.**`);
lines.push('');
lines.push('---');
lines.push('');
lines.push(result.summary.trim());
// The summary is the run's own report, left verbatim — rewriting a finding after the fact to match a
// later ruling is how a record stops being a record. The pointer goes after it instead.
if (resolvedCount) {
  lines.push('');
  lines.push(`> **Since this summary was written, ${resolvedCount === 1 ? 'one of the decisions it names has' : `${resolvedCount} of the decisions it names have`} been ruled on:** `
    + decisions.filter(resolvedFor).map((d) => `**(${d.decision})** — ${resolvedFor(d).ruling} (${resolvedFor(d).date})`).join(' · ')
    + ' The summary above is left as it was written.');
}
lines.push('');
lines.push('---');
lines.push('');
lines.push('## Flagged for a second look');
lines.push('');

const render = (d) => {
  lines.push(`### (${d.decision})`);
  lines.push('');
  lines.push(quote(d.text));
  if (d.amended && d.amended !== 'NONE') {
    lines.push('');
    lines.push('**Amended later, and the amendment is what holds:**');
    lines.push('');
    lines.push(quote(d.amended));
  }
  lines.push('');
  lines.push(`**Moved ${d.rowsCiting} row(s)** — ${d.byDisposition}. **Retired ${(d.retired ?? []).length}.**`);
  lines.push('');
  lines.push(`**What the project no longer has:** ${d.whatWasGivenUp}`);
  const res = resolvedFor(d);
  if (res) {
    lines.push('');
    lines.push(`> **RULED ${res.date} — ${res.ruling}**`);
    lines.push('>');
    lines.push(`> ${res.detail}`);
  }
  if (d.worthReview) {
    lines.push('');
    lines.push(`**${res ? 'Why it was flagged' : 'Why this deserves a look'}:** ${d.worthReviewWhy}`);
  }
  for (const r of d.retired ?? []) {
    lines.push('');
    lines.push(`<details><summary><code>${r.id}</code> — ${r.disposition}${r.destination && r.destination !== 'NONE' ? ` → ${r.destination}` : ''}</summary>`);
    lines.push('');
    lines.push('```');
    lines.push(String(r.rule ?? '').replace(/\n\s+/g, '\n').trim());
    lines.push('```');
    lines.push('');
    lines.push('</details>');
  }
  for (const c of d.changedRequirement ?? []) {
    lines.push('');
    lines.push(`**\`${c.id}\` — what it required changed:**`);
    lines.push('');
    lines.push(`- before: ${String(c.before).replace(/\n\s*/g, ' ').trim()}`);
    lines.push(`- after: ${String(c.after).replace(/\n\s*/g, ' ').trim()}`);
  }
  lines.push('');
};

for (const d of flagged) render(d);
lines.push('---');
lines.push('');
lines.push('## The rest, heaviest first');
lines.push('');
lines.push('Recorded so the count is complete and no retirement is invisible. Most retired nothing.');
lines.push('');
for (const d of rest) render(d);

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, lines.join('\n').replace(/\n{3,}/g, '\n\n') + '\n', 'utf8');
process.stdout.write(`decision_digest: ${decisions.length} decision(s), ${quoted.size} of 166 retired rule(s) quoted -> ${path.basename(out)}\n`);
