# CLAUDE.md § Claimed ground is excised ground — full rule

Each pipeline step that cookie-cutters geometry PERMANENTLY excises that geometry
from the layer. Once a cutter claims ground, no later step may receive it — the
same geometry reaching two excising steps is a bug class we have repeatedly found
by exactly this logic (bridge reservations leaving solid before ground derivation,
gap fill re-dabbing absorbed slivers, thin-wall/perimeter double deposits).

- The cut excises BEFORE any downstream ground is derived (ordering is part of
  the rule; the GIT_193 bridge-reservation shape is the model).
- RETRACTION vs RESIDUE — two different decline events that must not share a
  word. A cutter that decides NOT to take a candidate cut (nothing deposited,
  nothing derived downstream yet) RETRACTS: the ground rejoins THE ORIGINAL
  OWNER, as if never cut, at most once per site, and flows the normal partition —
  the pipeline is the router, the origin holds no routing knowledge. Ground that
  fell out of an EXERCISED claim (the cutter deposited what it could; this is
  the unfillable remainder) is RESIDUE: it never travels backward. It moves
  forward to the ONE successor the design names at that boundary (e.g. infill
  residue → gap fill), witnessed — and the chain terminates in a deposit or a
  declared, warned scrap (the "width-fitted or dropped and SAID" shape). Culled
  ground with no recipient is a void; ground re-reachable by two recipients is a
  double-write.
- Ground may be PROCESSED more than once (ironing over a top skin is fine) — the
  rule is ownership of deposit ground, not single-touch.
- The subtraction that excises must use the set the cutter ACTUALLY deposited (or
  formally claimed), never a recomputed equivalent — probes and remainders alike
  observe the real binding.
- When auditing, the question "which two steps both received this ground?" is the
  first question, because the census only sees the collision, not the submission.
  It has a lookup answer, because every decline site's recipient is static.
