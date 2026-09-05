// The five-state decision: given a command, the tool catalog and this project's observation
// record, what should happen to this invocation. Story:
// docs/superpowers/specs/2026-09-04-tool-assimilation-design.md ("The five states", "The ledger").
//
//   no observations                          -> observe, unwrapped
//   last observation quiet                   -> nothing (plain)
//   noisy - bespoke                          -> wrap (noisy)
//   noisy - off-the-shelf - candidates left  -> suggest params, unwrapped
//   noisy - off-the-shelf - exhausted        -> wrap (noisy)
//
// Pure: no I/O of its own. Loading the catalog and the observation record is the caller's job, so
// the whole state machine is exercisable from a literal and nothing here can read a stale file.
import { matchTool, matchedCandidate } from './catalog.mjs';
import { bespokeKey } from './observations.mjs';

// Both collections default to empty rather than being assumed present, and neither default is a
// stand-in value: an absent candidate list IS zero candidates, and an absent ledger IS zero
// recorded attempts. Both states are reachable. A bespoke tool that earns an outcome pattern
// through the training loop lands in the project catalog with an `outcome` and no candidates,
// because it has no documented quiet flags to declare; and observations.mjs promises that "a
// missing, truncated or hand-edited record is data, not a broken invariant", which only holds if
// the reader of that record agrees.
const candidatesOf = (entry) => entry.candidates ?? [];
const ledgerOf = (rec) => rec.ledger ?? {};

export function decide(command, { catalog, observations }) {
  const id = matchTool(command, catalog);
  if (id) {
    const entry = catalog[id];
    const rec = observations[id];
    if (!rec) return { mode: 'observe', id, identity: 'catalog' };
    if (!rec.noisy) return { mode: 'plain', id, identity: 'catalog' };
    const candidates = candidatesOf(entry);
    // A command that already carries a candidate is mid-trial, whatever the ledger says about that
    // flag. It stays unwrapped and observed: wrapping would change two variables at once and make
    // "did the flag help" unmeasurable, and suggesting on top of a flag the user already applied is
    // just noise. This check comes first for that reason - it can only ever route to observe.
    if (matchedCandidate(command, candidates)) return { mode: 'observe', id, identity: 'catalog' };
    const ledger = ledgerOf(rec);
    // Sufficient BEFORE untried, and the order is the whole rule. A tool with a known-working flag
    // is solved and merely forgotten this time, so it gets reminded of the answer. Checking untried
    // first would walk it through unproven flags while the working one sat in the ledger.
    const sufficient = candidates.find((c) => ledger[c] === 'sufficient');
    if (sufficient) return { mode: 'suggest', id, identity: 'catalog', suggestFlags: sufficient };
    // Termination is structural: the candidate list is finite and declared, every suggestion writes
    // one ledger entry, and a candidate with an entry is never suggested again. So at most one
    // suggest state per candidate, then wrap.
    const untried = candidates.find((c) => !(c in ledger));
    if (untried) return { mode: 'suggest', id, identity: 'catalog', suggestFlags: untried };
    return { mode: 'noisy', id, identity: 'catalog' }; // exhausted, none sufficient
  }
  // Bespoke: no entry, so nothing to look up and nothing to suggest. Straight to wrap on the first
  // noisy observation - the ledger is skipped entirely rather than consulted and found empty.
  const key = bespokeKey(command);
  const rec = observations[key];
  if (!rec) return { mode: 'observe', id: key, identity: 'bespoke' };
  if (!rec.noisy) return { mode: 'plain', id: key, identity: 'bespoke' };
  return { mode: 'noisy', id: key, identity: 'bespoke' };
}
