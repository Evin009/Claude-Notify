# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

macOS CLI tool. Hooks into Claude Code's Stop event. Fires a notification + plays music when a Claude task finishes. Configured via interactive TUI wizard.

## Commands

```bash
# Run all tests
npm test

# Run single test file
npx jest tests/config.test.js

# Run tests in watch mode
npx jest --watch

# Install globally (after build)
npm install -g .

# Run the CLI locally
node bin/claude-notify <command>

# Commands
node bin/claude-notify setup              # TUI wizard
node bin/claude-notify fire --duration=30 # trigger notification (30s elapsed)
node bin/claude-notify config             # print current config
node bin/claude-notify enable
node bin/claude-notify disable
```

## Architecture

**Entry point:** `bin/claude-notify` — Commander.js wires all subcommands, lazy-requires modules to keep startup fast.

**Data flow:** Claude Code Stop hook → `fire` command → `src/notify.js` reads config → fires `node-notifier` notification → calls `src/player.js` which spawns `afplay`.

**Config** (`~/.claude-notify.json`) is read on every `fire` call — no in-memory state. `src/config.js` merges disk JSON with `DEFAULT_CONFIG` so missing keys always fall back safely.

**Audio** (`src/player.js`) spawns `afplay` as a child process, sets a `setTimeout` to kill it after `musicDuration` seconds. All errors caught silently — `fire` must always exit 0 or it breaks Claude Code.

**Track resolution** (`src/library.js`): built-in IDs (e.g. `lofi-1`) resolve to `music/<file>.mp3`. Absolute paths pass through as-is. Unknown IDs return `null` → player skips.

**Hook patching** (`src/hooks.js`): reads `~/.claude/settings.json`, appends Stop hook entry idempotently. `patchHook()` is a no-op if hook already present.

**Wizard** (`src/wizard.js`): Inquirer.js prompts → calls `writeConfig` + `patchHook`. Plays 3s preview via `player.js` during track selection.

## Testing

Jest, Node test environment. Each module has a paired test file in `tests/`. Mocking pattern: `jest.mock('node-notifier')`, `jest.mock('child_process')` for player tests, `jest.mock('os')` with a temp dir for hooks tests.

Wizard (`src/wizard.js`) is not unit tested — manual test only (Inquirer can't be unit tested cleanly).

## Key Constraints

- `claude-notify fire` must always exit 0. Wrap all audio/notify calls in try/catch.
- `afplay` is macOS-only. No fallback needed — this tool is macOS-only by design.
- Config writes are full-object rewrites (not partial patches) — always spread existing config before writing.
- Hook patching is idempotent — check `hookInstalled()` before calling `patchHook()`.

## Workflow — Follow Exactly Every Phase

### 1. Phase Start
- Branch: `git checkout -b phase-N-<short-name>`
- Write concise phase aim in caveman style (what it builds, why it matters)
- Wait for explicit user approval before writing any code

### 2. During the Phase
- Work task by task per the implementation plan
- Mark completed task checkboxes `[x]` in `docs/superpowers/plans/2026-06-26-claude-notify-plan.md`
- Stage relevant files + updated plan checklist → commit after each task
- Never batch multiple tasks into one commit

### 3. Phase End
- Push branch: `git push -u origin phase-N-<short-name>`
- Open PR against `main`
- Run `/code-review` — address all findings before merging
- CI must be green (lint + tests) before merge

### 4. Post-Merge
- Append entry to `docs/build-log.md` using caveman style
- Build log rules: plain language only — no API names, framework names, or engineering acronyms. Non-engineer must understand every bullet.
- Write bulleted summary: what was built, what's now live, decisions made and why

## Implementation Plan Location

`docs/superpowers/plans/2026-06-26-claude-notify-plan.md`

Use `superpowers:subagent-driven-development` skill for execution.
