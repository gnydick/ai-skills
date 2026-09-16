#!/usr/bin/env node
// The regression guard for machinery's shipped rules (#110).
//
// WHY THIS EXISTS. The 2026-09 recalibration rewrote 13 skills and core.md from a draft and silently
// lost 34 requirements — clauses whose own ledger notes named them, a trigger the consolidation
// inverted, an inserted "only" that forbade what its source permitted. Four audit passes found them.
// Nothing would have. There is no test of skill prose in this repository, so the same rewrite could
// undo every one of those repairs tomorrow and only another audit would notice.
//
// WHAT IT GUARANTEES, exactly: a protected requirement cannot leave the shipped rule set SILENTLY.
// Deleting or rewording one fails this check, and the only way past it is to edit the ledger in the
// same commit — which puts the change in the diff where a human sees it. That is the whole claim. It
// is rung 5 on the cant-break-by-design ladder, not rung 8: the requirement is not unrepresentable,
// it is undeletable-without-saying-so.
//
// WHAT IT DOES NOT CATCH, stated because a guard whose reach is narrower than its name is the exact
// failure this campaign kept finding:
//   1. Semantic inversion where the phrase survives. `core.md` once read "cite it ONLY in specs",
//      which forbade the venue its source permits, while still containing the word "cite". A naive
//      presence check passes that. `mustNot` is the answer where the inverted form is known and
//      writable; where it is not, the entry says so in `blindTo`.
//   2. Whether a rule is FOLLOWED. This proves text is present, never that an agent obeys it. No
//      eval exists in this repository that fires a rule and checks compliance.
//
// WHY IT IS NOT A GATE CHECK. The gate is copied into adopting projects under `.githooks/machinery/`.
// Those projects do not author machinery's rules and have no `claude-code/machinery/` to point at, so
// a gate check would fail everywhere it was installed. This guards this repository's own sources and
// belongs to this repository's own tooling — it runs as a test, in the fast and merge tiers.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const LEDGER = path.join(HERE, 'rule-ledger.json');
const REPO = path.resolve(HERE, '..');

export function load(file = LEDGER) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(raw.entries) || raw.entries.length === 0) {
    // An empty ledger passing vacuously is the "skipped check reads as a pass" shape that
    // `tool-output.md` forbids. A zero denominator is never a clean bill of health.
    throw new Error('rule-ledger: the ledger has no entries — a check with nothing to check is not a passing check');
  }
  return raw;
}

// {root, ledger} → {checked, failures[]}. Pure over the filesystem it is handed: the tests point it
// at fixtures, so its own red check does not need this repository to be broken first.
export function verify({ root = REPO, ledger = load() } = {}) {
  const failures = [];
  const cache = new Map();
  const read = (rel) => {
    if (!cache.has(rel)) {
      const f = path.join(root, rel);
      cache.set(rel, fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null);
    }
    return cache.get(rel);
  };

  for (const e of ledger.entries) {
    const text = read(e.file);
    if (text === null) {
      failures.push({ id: e.id, file: e.file, kind: 'file-missing', detail: `${e.file} does not exist` });
      continue;
    }
    if (e.must && !text.includes(e.must)) {
      failures.push({ id: e.id, file: e.file, kind: 'requirement-gone', detail: `${e.file} no longer contains: "${e.must}"`, why: e.why });
    }
    if (e.mustNot && text.includes(e.mustNot)) {
      failures.push({ id: e.id, file: e.file, kind: 'inversion-returned', detail: `${e.file} contains the forbidden form: "${e.mustNot}"`, why: e.why });
    }
  }
  return { checked: ledger.entries.length, failures };
}

// The declared proof format (plugins/machinery/rules/tool-output.md § Proof lines and denominators):
// a count against its denominator. The denominator is protected requirements, and it is the honest
// one — every entry is checked on every run, so a failure cannot hide outside the population.
export function proofLine({ checked, failures }) {
  return `rule_ledger: ${failures.length} of ${checked} protected requirement(s) missing or inverted`;
}

export function report(result) {
  const lines = [proofLine(result)];
  for (const f of result.failures) {
    lines.push(`rule_ledger: ${f.id} — ${f.detail}`);
    if (f.why) lines.push(`rule_ledger:   why it is protected: ${f.why}`);
  }
  if (result.failures.length) {
    lines.push('rule_ledger: restore the requirement, or edit scripts/rule-ledger.json in this commit so the change is visible in the diff.');
  }
  return lines;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = verify();
  process.stdout.write(report(result).join('\n') + '\n');
  process.exit(result.failures.length ? 1 : 0);
}
