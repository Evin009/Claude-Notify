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

---

## Phase 2 — Config
**Date:** 2026-06-28

**Aim:** Build config system. Every other module reads from this — get it right once so nothing else handles missing or broken config.

**What got built:**
- Tool now reads and writes a settings file stored in the user's home folder
- If settings file missing or broken, tool silently falls back to safe defaults — no crash, no noise
- Settings always merge with defaults so new fields added in future never break old config files
- 4 tests covering: no file, partial file, write, corrupt file

**Decisions made:**
- Corrupt config treated same as missing config — both return defaults silently. Design choice: tool should always work, even if user hand-edited the file badly
- Config is always written as full object, never patched — simpler, no partial-write bugs
- Read happens fresh on every call, no caching — config is tiny, disk read is instant, avoids stale-state bugs

**Bugs caught:**
- Code review found `writeConfig` had no error handling — disk full or permission error would crash the `enable`/`disable` commands with an ugly unhandled exception. Fixed: now prints readable error to terminal instead of crashing.

---

## Phase 3 — Core Notification
**Date:** 2026-06-28

**Aim:** Wire the actual popup. First time `fire` does something visible on screen.

**What got built:**
- Running `claude-notify fire --duration=154` now shows a macOS popup saying "Claude done · 2m 34s"
- Duration formats cleanly: zero duration shows "Claude done" with no trailing text
- If music is configured, hands off to audio player (stub for now, real audio in next phase)
- Tool does nothing when disabled — reads that from config, returns immediately
- 5 unit tests, 14 total passing

**Decisions made:**
- Notification module itself has no safety net — the entry point (the command runner) already wraps everything in a catch. One catch in the right place beats try/catch scattered across every function
- Music only plays if both a track is set AND duration is greater than zero — two conditions, not one, avoids playing music when user sets track but sets duration to 0 to mute it

**Bugs caught:**
- Code review raised 4 potential crash scenarios (unguarded calls inside fire). All verified as safe — the entry point catch from Phase 1 already covers them. No changes needed.
