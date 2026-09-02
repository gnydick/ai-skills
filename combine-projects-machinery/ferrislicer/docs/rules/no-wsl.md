# CLAUDE.md § No WSL — full rule

Ruled by Gabe 2026-08-25 (RULE:-dictated): **we don't use WSL in this project
until otherwise stated.** The POSIX shell here is Git Bash
(`C:\Program Files\Git\usr\bin\bash.exe`). Windows-native tooling and Git Bash
are the whole toolchain; nothing invokes `wsl.exe` or runs under a WSL distro.

- **Bare `bash` is not Git Bash.** Windows ships a WSL launcher stub at
  `C:\Windows\System32\bash.exe`. Anything resolving `bash` by PATH lookup —
  Python's `subprocess`, a `Command::new("bash")`, a hook — can land on the stub,
  which prints "Windows Subsystem for Linux has no installed distributions" as
  UTF-16 and exits 1. Measured 2026-08-25: this made
  `scripts/testq_verdict_test.py`'s `bash -n` syntax check report a clean file as
  broken, while the identical check from Git Bash returned 0.
- **Resolve a real bash, and fail loudly if there is none.** Reject any candidate
  under `System32`, `SysWOW64`, or `WindowsApps`. A tool that cannot find a usable
  bash SAYS SO, naming what it looked for — it never skips quietly, because a
  skipped check reads as a pass (see § Warn loudly, and the gate-integrity rules).
- "Until otherwise stated" is literal: this is a scope decision Gabe can lift, not
  a claim that WSL is unusable.
