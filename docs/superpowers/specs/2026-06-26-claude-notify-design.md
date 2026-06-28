# Claude-Notify — Design Spec
**Date:** 2026-06-26  
**Status:** Approved

---

## Overview

CLI tool that hooks into Claude Code's Stop event to fire a macOS notification and optionally play music when a Claude task completes. Configured via an interactive TUI wizard.

---

## Architecture

```
claude-notify/
├── bin/
│   └── claude-notify        # CLI entrypoint (node shebang)
├── src/
│   ├── notify.js            # fires Mac notification via node-notifier
│   ├── config.js            # read/write ~/.claude-notify.json
│   ├── wizard.js            # interactive TUI setup via Inquirer.js
│   ├── player.js            # audio playback via afplay (macOS native)
│   └── library.js           # built-in music track metadata
├── music/                   # bundled lo-fi/ambient MP3 clips
└── package.json
```

---

## Data Flow

```
Claude Code task finishes
        ↓
Stop hook fires: claude-notify fire --duration=<elapsed_seconds>
        ↓
notify.js reads ~/.claude-notify.json
        ↓
node-notifier  →  Mac notification: "Claude done · 2m 34s"
player.js      →  afplay <track> for N seconds, then kills process
```

---

## CLI Commands

| Command | Description |
|---|---|
| `claude-notify setup` | Interactive TUI wizard — configure all options, auto-patch Claude Code hooks |
| `claude-notify fire --duration=<s>` | Called by Claude Code Stop hook — sends notification + plays audio |
| `claude-notify config` | Print current config |
| `claude-notify disable` | Temporarily disable without removing hook |
| `claude-notify enable` | Re-enable |

---

## Config Schema (`~/.claude-notify.json`)

```json
{
  "enabled": true,
  "music": "lofi-1",       // built-in track name OR absolute path to custom file
  "musicDuration": 15,     // seconds to play; 0 = disabled
  "volume": 80             // 0–100
}
```

---

## TUI Wizard Flow (`claude-notify setup`)

1. Enable notifications? (y/n)
2. Enable music? (y/n)
   - If yes: pick from built-in library (3s preview plays) OR enter custom file path
3. Music duration in seconds (default: 15)
4. Volume level 0–100 (default: 80)
5. Auto-patch `~/.claude/settings.json` with Stop hook:
   ```json
   {
     "hooks": {
       "Stop": [{ "command": "claude-notify fire --duration=$CLAUDE_SESSION_DURATION" }]
     }
   }
   ```

---

## Built-in Music Library

| ID | Name | Vibe |
|---|---|---|
| `lofi-1` | Rainy Day | Lo-fi hip hop |
| `lofi-2` | Late Night` | Chill beats |
| `ambient-1` | Forest | Nature ambient |
| `ambient-2` | Space` | Synth pad |
| `chime` | Done Chime | Short bell notification |

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Missing `~/.claude-notify.json` | Silent defaults: notify only, no music |
| Custom file path doesn't exist | Warn at setup time; skip audio silently at fire time |
| `afplay` not available | Log warning on setup; notification still fires |
| Stop hook passes no duration | Notification omits duration — shows "Claude done" |
| Music duration = 0 | Skip audio entirely |

---

## Dependencies

| Package | Purpose |
|---|---|
| `node-notifier` | macOS notification |
| `inquirer` | TUI wizard prompts |
| `commander` | CLI argument parsing |

Audio playback uses `afplay` (ships with macOS) — no extra audio dependency needed.

---

## Out of Scope

- Windows/Linux support
- AI-generated task summaries (future enhancement)
- Notification click actions
- Per-project config overrides
