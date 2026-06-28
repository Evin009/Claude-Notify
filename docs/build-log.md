# Build Log

---

## Phase 1 — Scaffold
**Date:** 2026-06-28

**Aim:** Lay foundation. Wire up command structure. Build first working piece of logic.

**What got built:**
- Tool now has a command-line interface — type `claude-notify <command>` and it routes to right action
- Five commands wired: `fire`, `setup`, `config`, `enable`, `disable` — most not functional yet, scaffolding only
- Time formatter built and tested — turns raw seconds into readable format like "2m 34s"
- Project structure set: source files, test files, dependency list all in place

**Decisions made:**
- Commands load their modules only when called, not at startup — keeps tool fast to launch even as it grows
- `fire` command (the one Claude Code calls automatically) wrapped in safety net so it never crashes the calling process — if anything goes wrong internally, tool fails silently rather than disrupting Claude
- `formatDuration(0)` returns empty string, not "0s" — a task with zero elapsed time shows no duration in notification

**Bugs caught:**
- Missing safety net on `fire` command found in code review — async errors could escape and cause non-zero exit, breaking Claude Code's hook system. Fixed before merge.
