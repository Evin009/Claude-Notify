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

---

## Phase 4 — Audio Player
**Date:** 2026-06-28

**Aim:** Replace audio stub with real playback. Music plays after notification fires, stops after user-set duration.

**What got built:**
- Audio now plays when Claude finishes a task — spawns the built-in macOS audio player under the hood
- Volume controlled 0–100, converted to the format the audio player expects
- Stops automatically after configured duration — timer kills the audio process
- If audio finishes before the timer, timer cancels cleanly — no zombie processes
- All errors swallowed silently — bad file, missing audio tool, any crash — notification already fired, audio is bonus
- 4 unit tests, 18 total passing

**Decisions made:**
- Audio player has its own internal safety net (separate from the entry point catch) because the async error event from spawning a process is a different failure path that the outer catch can't reach
- Negative or missing duration treated as 1 second minimum then kill — avoids immediate-kill edge case from hand-edited config

**Bugs caught:**
- Review found missing error handler on the spawned process — Node.js emits errors from child processes as events, not exceptions, so the outer try/catch can't catch them. Unhandled event would crash the process. Fixed: silent error handler added.
- Review found negative duration in config would cause timer to fire immediately and kill audio before it starts. Fixed: duration clamped to minimum 1 second.

---

## Phase 5 — Music Library
**Date:** 2026-06-30

**Aim:** Replace track stub with real metadata. Built-in IDs map to bundled files. Custom paths pass through.

**What got built:**
- 5 built-in tracks defined: two lo-fi, two ambient, one short chime
- Track IDs (like `lofi-1`) resolve to actual file paths inside the tool's music folder
- Custom absolute file paths (user's own music) pass through unchanged
- Unknown IDs return nothing — player skips silently
- `listTracks()` exposes track list for the setup wizard to display
- 5 unit tests, 23 total passing

**Decisions made:**
- MP3 files not bundled in repo — user adds royalty-free clips to `music/` folder. README in that folder explains what to add and where to find free music
- Custom path validation intentionally skipped — single-user local tool, user is responsible for their own file paths

**Bugs caught:**
- Review flagged 3 issues — all refuted. One was a diff transcription error (code was correct). One was design-by-intent (custom paths). One was correct behavior (empty string returns null).

---

## Phase 6 — Hook Integration
**Date:** 2026-06-30

**Aim:** Wire the tool into Claude Code automatically. No manual JSON editing by user.

**What got built:**
- Reads Claude Code's settings file and adds a line that tells it to call our tool when it finishes a task
- Safe to run twice — checks first, adds only if missing
- Preserves everything else in the settings file untouched
- Can also remove the hook without touching anything else
- 6 unit tests, 29 total passing

**Decisions made:**
- Corrupt settings.json now throws instead of returning empty object — prevents accidentally overwriting user's entire Claude Code config with a blank slate
- Stop hook value validated as array before calling filter — malformed but valid JSON won't crash
- Race condition (two simultaneous calls) intentionally not handled — single-user CLI tool, not worth the complexity

**Bugs caught:**
- Review found corrupt JSON would cause the tool to silently overwrite user's entire Claude Code config with a blank file — data loss. Fixed: now throws on corrupt JSON instead of swallowing error.
- Review found `.filter()` called on `Stop` without confirming it's an array — malformed settings could crash. Fixed: Array.isArray guard added.

---

## Phase 7 — TUI Setup Wizard
**Date:** 2026-06-30

**Aim:** Build the setup experience. Last piece. Tool fully usable after this.

**What got built:**
- `claude-notify setup` walks through all options with interactive prompts
- Music selection shows all built-in tracks by name and plays a 3-second preview of whichever track user picks
- Custom file path accepted for user's own music
- Duration and volume configured in same flow
- Automatically adds itself to Claude Code's settings at the end — no manual JSON editing
- If hook patching fails (corrupt settings file), shows manual instructions instead of crashing
- Config save result now accurate — shows failure message if write failed instead of always saying "saved"

**Decisions made:**
- Used dynamic import for Inquirer (ESM package) — required instead of static require to avoid module system mismatch
- Wizard has no unit tests — Inquirer prompts can't be unit tested cleanly; manually verified instead

**Bugs caught:**
- Review found `hookInstalled()` and `patchHook()` could throw if Claude Code's settings file was corrupt — would crash wizard mid-setup. Fixed: wrapped in try/catch, falls back to showing manual instructions.
- Review found config-save success message printed unconditionally even when write failed. Fixed: checks result and shows accurate message.
