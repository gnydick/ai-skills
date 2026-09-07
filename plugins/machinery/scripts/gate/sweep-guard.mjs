import { git } from '../lib/git.mjs';
// Ported from sweep_guard.sh. ADVISORY: never affects the outcome; silent when nothing to say.

// Declared like every other check (#73, I43) rather than called beside the array. Before this the
// gate had two execution paths and the closed array described only one of them — the exact rot the
// ticket exists to remove. `blocking: false` is what keeps it out of the exit code; the gate's loop
// is the one place that reads it, so an advisory can no longer fail a commit even by throwing.
export const declaration = Object.freeze({
  id: 'sweep_guard',
  run: 'sweepGuard',
  blocking: false,
  wired: true,
  claims: Object.freeze([
    { file: 'plugins/machinery/rules/worktree-discipline.md', quote: 'An advisory backstop fires when a documentation-shaped commit also adds a brand-new non-documentation file, naming it without blocking.' },
    { file: 'docs/superpowers/specs/2026-09-02-machinery-plugin-core-design.md', quote: 'The advisory sweep guard is outside this claim' },
    { file: 'combine-projects-machinery/union/plugin/gates/commit-gate.md', quote: 'plus the advisory warning; nothing validates citations at commit or merge time' },
  ]),
});

const DOCS = /^(CLAUDE\.md$|docs\/|\.claude\/rules\/|\.claude\/machinery\/)/;
const TOOLING = /^(scripts\/|\.githooks\/)/;
export function sweepGuard({ root }) {
  const staged = git(['diff', '--cached', '--name-only'], root).stdout.split('\n').filter(Boolean);
  const added = git(['diff', '--cached', '--diff-filter=A', '--name-only'], root).stdout.split('\n').filter(Boolean);
  const suspects = added.filter((f) => !DOCS.test(f));
  if (!suspects.length) return;
  if (!staged.some((f) => DOCS.test(f))) return;
  const addedSet = new Set(added);
  const others = staged.filter((f) => !addedSet.has(f) && !DOCS.test(f) && !TOOLING.test(f));
  if (others.length) return;
  process.stdout.write(`ADVISORY: sweep-guard denominator: ${staged.length} staged, ${added.length} newly-tracked, ${suspects.length} non-doc suspect(s).\n`);
  for (const f of suspects) process.stdout.write(`ADVISORY: docs commit stages a newly-tracked non-doc file: ${f} - confirm not swept by a wildcard git add.\n`);
}
