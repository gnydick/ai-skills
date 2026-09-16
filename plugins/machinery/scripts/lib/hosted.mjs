// The hosted check: the one sentence that makes it block, and the one line that reports it.
//
// Owner ruling 2026-09-02, carried in the header of the `hosted-check.yml` template:
// "The hosted check BLOCKS: protect the branch on this job." Recalibration decision (14) replaced
// that template with the `--hosted-ci` wizard and authorised the wizard, not the loss of the rule
// the template stated. The sentence went missing in the swap and shipped missing for two days;
// #110's audit found it as ledger row M518 — the only one of 47 `mechanism` rows whose destination
// did not carry its rule.
//
// Why this is prose and not a check: branch protection is a forge setting. Nothing in this
// repository can read it, set it, or verify it, so this sentence IS the mechanism — a workflow
// that reports red and cannot stop a merge is exactly what the ruling forbids. Spelled here once
// so the generated workflow and the status line cannot disagree about it.
export const HOSTED_BLOCKS =
  'This check BLOCKS (owner ruling 2026-09-02): make this job a required status check on the '
  + 'protected branch. Until you do, a red result here does not stop a merge.';

// install.mjs and banner.mjs both report whether the workflow exists, and had drifted into two
// hand-maintained copies of the same sentence (the tripwire in `unbreakable:cant-break-by-design`:
// the same step at a second call site means the choke-point is owed). One function, both callers.
//
// The `present` arm used to read just "present", which is what let M518 hide: a project whose
// workflow exists but is not required saw a line that looked like success. It now names the
// condition the ruling turns on, every time it is printed.
export function hostedCheckLine(exists) {
  return exists
    ? 'present — it blocks only while it is a required status check on the protected branch'
    : 'none — the pre-push hook is the blocking check before main; /machinery:install --hosted-ci writes one';
}
