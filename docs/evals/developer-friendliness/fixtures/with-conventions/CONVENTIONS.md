# Conventions

## Where things go

- **Decisions** — `docs/decisions.md`. Anything a future reader might
  reasonably want to reopen. Newest last.
- **Known issues / deferred work** — `docs/issues.md`. Anything found and
  not fixed. Newest last.
- **Anything the next person needs to pick up work** — `docs/notes.md`.

Do not add new top-level documents without asking. We have had three
competing notes files before and nobody read any of them.

## Style

- Python 3.11, standard library only. Adding a dependency is a decision.
- Every bug fix gets a regression test in `tests/`.
