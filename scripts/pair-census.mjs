#!/usr/bin/env node
// The ticket-pair census (#97). Every full ticket owes exactly one companion
// titled `Context: #N`, bound to it by the tracker's real sub-issue
// relationship — not by the title matching, which is a mention
// (plugins/machinery/rules/work-tracking.md § A ticket and its companion).
//
// On 2026-09-10 a by-hand sweep found 12 of 46 companions with no sub-issue link
// at all. Nothing counted them, so the breakage was invisible for as long as it
// took somebody to sweep by hand. The 12 were repaired on 2026-09-11. This file
// is the thing that notices next time.
//
// WHY IT LIVES IN scripts/ AND NOT IN THE GATE. Gabe, 2026-09-11, verbatim:
// "graphql query plus CI".
//   - One GraphQL query per page, fetching every issue at once, rather than the
//     by-hand sweep's one REST call per companion. At 50 companions and rising
//     that is the difference between a check that scales and one that gets
//     deleted the first time it is slow.
//   - A CI leg (.github/workflows/check.yml), not .githooks/pre-commit. The gate
//     runs on every commit under a 20-second budget; a network round trip does
//     not belong there, and putting it there would let that budget decide the
//     design by accident.
// It is repo tooling — it asks this repository's tracker about this
// repository's tickets — so it sits beside build-skills.mjs and eval-results.mjs
// rather than inside the machinery plugin, which ships to other projects and
// knows nothing about this tracker.
//
// WHAT IT CANNOT SEE, stated in its own output every run: a companion not titled
// `Context: #N`, a ticket with no companion at all, and any link other than the
// sub-issue link.
//
// Usage:
//   GITHUB_TOKEN=$(gh auth token) node scripts/pair-census.mjs --repo gnydick/ai-skills
//   # in CI, GITHUB_TOKEN and GITHUB_REPOSITORY are both already in the environment
//
// Exit codes: 0 clean, 1 offenders found, 2 the census could not run.

import { pathToFileURL } from 'node:url';

const API = 'https://api.github.com/graphql';
const PAGE_SIZE = 100;
// A page cap, not a timeout: an unbounded `while (hasNextPage)` against a
// misbehaving API is a hang, and a hang in CI reads as a check nobody ran.
const MAX_PAGES = 50;

// The companion title is the only handle the census has on a pair, so it is
// anchored at both ends: `Context: #97 — pickup` is a differently-shaped title
// and admitting it would put a non-pair in the denominator.
export const COMPANION_TITLE = /^Context: #(\d+)$/;

export const QUERY = `
query($owner: String!, $name: String!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    issues(first: ${PAGE_SIZE}, after: $cursor, states: [OPEN, CLOSED], orderBy: {field: CREATED_AT, direction: ASC}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number
        title
        state
        parent { number }
      }
    }
  }
}`;

// Raised for every way this check can be blind. It is a distinct type, not a
// message, because the one thing that must never happen is a blind run coming
// out as a clean run: the caller exits 2 on this and prints no proof line, so a
// census that could not run can never be read as a census that found nothing.
export class CensusUnavailable extends Error {
  constructor(message) { super(message); this.name = 'CensusUnavailable'; }
}

export const BLIND_SPOTS = Object.freeze([
  'a companion not titled `Context: #N`',
  'a ticket with no companion at all',
  'any link other than the sub-issue link',
]);

// Classifies the issue nodes the query returned. The availability checks live
// inside this function rather than beside it so there is no route to a result
// that skipped them: the only way to obtain a census is through the call that
// also refuses an invisible one.
export function census(nodes) {
  if (!Array.isArray(nodes)) throw new CensusUnavailable('the tracker returned no issue list at all');
  if (nodes.length === 0) {
    throw new CensusUnavailable(
      'the tracker returned 0 issues — a repository with no issues at all cannot be the one this check was pointed at',
    );
  }

  const companions = [];
  for (const node of nodes) {
    const matched = COMPANION_TITLE.exec(node.title ?? '');
    if (!matched) continue;
    companions.push({ companion: node.number, ticket: Number(matched[1]), parent: node.parent ? node.parent.number : null });
  }

  if (companions.length === 0) {
    throw new CensusUnavailable(
      `${nodes.length} issue(s) matched no \`Context: #N\` companion — the title convention or this matcher has moved, and a zero denominator is not a clean bill of health`,
    );
  }

  // Two defects, kept apart all the way to the output. A companion that was
  // never bound needs linking; one bound to somebody else's ticket needs
  // unpicking first, and whoever reads the failure needs to know which.
  const unlinked = companions.filter((c) => c.parent === null);
  const wrongParent = companions.filter((c) => c.parent !== null && c.parent !== c.ticket);

  return {
    issues: nodes.length,
    companions,
    unlinked,
    wrongParent,
    offenders: [...unlinked, ...wrongParent],
  };
}

// The declared proof format (plugins/machinery/rules/tool-output.md § Proof
// lines and denominators): a count against its denominator, on its own output.
// Pass or fail alone is not enough — a pass for a bad reason is exactly what
// gets compressed away.
export function proofLine(result) {
  return `pair_census: ${result.offenders.length} of ${result.companions.length} companion(s) unlinked or attached to the wrong ticket`;
}

export function reportLines(result) {
  const lines = [proofLine(result)];
  // Ticket #97 required behaviour 3: linked, unlinked and wrong-parent counts
  // against the total, not only the offender count. The headline above carries
  // the number that decides pass or fail; this carries the breakdown, so a
  // reader sees which of the two repairs is owed without counting the lines
  // underneath. Every count here comes off the single classification census()
  // already made — nothing recounts anything.
  lines.push(
    `pair_census: ${result.companions.length - result.offenders.length} of ${result.companions.length} companion(s) correctly linked; `
    + `${result.unlinked.length} unlinked, ${result.wrongParent.length} attached to the wrong ticket`,
  );
  for (const c of result.unlinked) {
    lines.push(`pair_census: #${c.companion} "Context: #${c.ticket}" has no sub-issue parent — it is paired to #${c.ticket} by its title only`);
  }
  for (const c of result.wrongParent) {
    lines.push(`pair_census: #${c.companion} "Context: #${c.ticket}" parent is #${c.parent}, expected #${c.ticket}`);
  }
  lines.push(`pair_census: cannot see ${BLIND_SPOTS.join('; ')}`);
  return lines;
}

function resolveRepository(argv, env) {
  const flagAt = argv.indexOf('--repo');
  const flag = flagAt === -1 ? undefined : argv[flagAt + 1];
  const value = flag ?? env.GITHUB_REPOSITORY;
  if (!value) {
    throw new CensusUnavailable('no repository to census: looked at the --repo argument and $GITHUB_REPOSITORY, and found neither');
  }
  const [owner, name, ...rest] = value.split('/');
  if (!owner || !name || rest.length) {
    throw new CensusUnavailable(`the repository "${value}" is not in owner/name form (from ${flag ? '--repo' : '$GITHUB_REPOSITORY'})`);
  }
  return { owner, name };
}

function resolveToken(env) {
  const token = env.GITHUB_TOKEN || env.GH_TOKEN;
  if (!token) {
    throw new CensusUnavailable(
      'no API token: looked at $GITHUB_TOKEN and $GH_TOKEN, and found neither. In CI, grant the job `permissions: issues: read`; locally, run with GITHUB_TOKEN=$(gh auth token)',
    );
  }
  return token;
}

async function fetchPage({ owner, name, cursor, token }) {
  let response;
  try {
    response = await fetch(API, {
      method: 'POST',
      headers: {
        authorization: `bearer ${token}`,
        'content-type': 'application/json',
        'user-agent': 'ai-skills-pair-census',
      },
      body: JSON.stringify({ query: QUERY, variables: { owner, name, cursor } }),
    });
  } catch (cause) {
    throw new CensusUnavailable(`could not reach ${API}: ${cause.message}`);
  }

  if (response.status === 403 || response.status === 429) {
    const remaining = response.headers.get('x-ratelimit-remaining');
    throw new CensusUnavailable(
      `${API} answered ${response.status} (rate limit or insufficient token scope; x-ratelimit-remaining=${remaining ?? 'unset'}): ${(await response.text()).slice(0, 400)}`,
    );
  }
  if (!response.ok) {
    throw new CensusUnavailable(`${API} answered ${response.status}: ${(await response.text()).slice(0, 400)}`);
  }

  let body;
  try {
    body = await response.json();
  } catch (cause) {
    throw new CensusUnavailable(`${API} answered 200 with a body that is not JSON: ${cause.message}`);
  }

  // A GraphQL error arrives inside a 200, which is the shape that most easily
  // passes for success. The `parent` field in particular comes back as an error
  // here, not a null, if the token cannot read sub-issue relationships.
  if (body.errors?.length) {
    throw new CensusUnavailable(`${API} returned GraphQL errors: ${body.errors.map((e) => e.message).join(' | ')}`);
  }
  const issues = body.data?.repository?.issues;
  if (!issues) {
    throw new CensusUnavailable(`${API} returned no repository for ${owner}/${name} — it does not exist, or this token cannot see it`);
  }
  return issues;
}

async function fetchAllIssues({ owner, name, token }) {
  const nodes = [];
  let cursor = null;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const issues = await fetchPage({ owner, name, cursor, token });
    nodes.push(...issues.nodes);
    if (!issues.pageInfo.hasNextPage) return nodes;
    cursor = issues.pageInfo.endCursor;
  }
  throw new CensusUnavailable(`the tracker still had pages after ${MAX_PAGES} of ${PAGE_SIZE} issues — refusing to page forever`);
}

async function main(argv, env) {
  const { owner, name } = resolveRepository(argv, env);
  const token = resolveToken(env);
  const result = census(await fetchAllIssues({ owner, name, token }));
  for (const line of reportLines(result)) process.stdout.write(`${line}\n`);
  return result.offenders.length === 0 ? 0 : 1;
}

// Only the CLI entry runs main; importing this file for its exports must never
// open a socket, because the unit tests that import it run on the pre-commit
// hook, where the network was deliberately ruled out.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2), process.env).then(
    (code) => process.exit(code),
    (error) => {
      // A check that cannot run fails loudly, naming exactly what it could not
      // reach, and never prints a proof line — because a skipped check reads as
      // a pass (rules/environment-and-platform.md § Resolving a tool;
      // rules/tool-output.md § Proof lines and denominators).
      process.stderr.write(`pair_census: CANNOT RUN: ${error.message}\n`);
      process.exit(2);
    },
  );
}
