# Environment and platform

Which platform layers a project uses, how a tool is resolved, and what may
enter the dependency set. Loaded at session start.

## Platform scope

- A whole platform layer can be ruled out of a project by decision. State it
  literally: it is a scope decision the owner can lift, not a claim that the
  excluded thing does not work.
- Name what the toolchain actually is — the shell, at its full path, plus the
  platform-native tools — and let nothing in the project invoke the excluded
  layer.

## Resolving a tool

- A bare command name is not the tool you meant. Resolving it by search path can
  land on a same-named stub the operating system ships, which fails in a way
  that reads as your own file being broken rather than the wrong tool having
  run.
- Resolve the real tool by explicit path, and reject candidates in the known
  locations where the lookalike lives. Rejecting the known-bad ones is part of
  resolving, not a separate check.
- A tool that cannot resolve what it needs fails loudly, naming what it looked
  for. It never skips quietly, because a skipped check reads as a pass. This
  one fires while a tool is being resolved, and what discharges it is the
  explicit-path resolution above — naming the candidates it looked for and
  rejecting the known lookalikes. The same closing words appear in
  `rules/tool-output.md` § Proof lines and denominators, where the trigger is a
  check that cannot run and what discharges it is that file's proof-line
  contract. Different triggers, different remedies, so the demand is filed in
  both groups deliberately and cross-referenced here, rather than one being a
  copy of the other.

## Dependencies

- Never add a new external dependency without stopping and getting the owner's
  explicit authorization first.
- Prefer dependencies that bring few or no dependencies of their own.
- Installs run against the frozen lock file only, so an install can never
  quietly move a pinned version.
- Package lifecycle scripts are blocked by default, with an explicit allowlist
  naming each package permitted to run one.
- A published version must be a stated minimum age before it may be installed,
  so a freshly published compromised release is not picked up on the day it
  lands.
- The tool that installs dependencies is itself pinned to a stated major
  version, because the policy switches above depend on features that version
  provides.

<!-- rows: 11.1–11.11 -->
