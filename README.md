# Claude Notify

macOS notification + music when Claude Code finishes a task.

![macOS notification saying "Claude done · 2m 34s"](https://img.shields.io/badge/platform-macOS-blue)

## What it does

Claude Code runs tasks that can take minutes. This tool hooks into Claude's completion event and:
1. Fires a macOS notification with how long the task took
2. Optionally plays music for a set duration

## Install

```bash
git clone https://github.com/Evin009/Claude-Notify.git
cd Claude-Notify
npm install
npm install -g .
```

## Setup

```bash
claude-notify setup
```

Walks through all options interactively, plays 3s preview of each track, then auto-wires itself into Claude Code.

## Commands

| Command | What it does |
|---|---|
| `claude-notify setup` | Interactive wizard — configure everything |
| `claude-notify config` | Print current settings |
| `claude-notify enable` | Turn notifications on |
| `claude-notify disable` | Turn notifications off (hook stays, just silenced) |

## Config

Stored at `~/.claude-notify.json`:

```json
{
  "enabled": true,
  "music": "lofi-1",
  "musicDuration": 15,
  "volume": 80
}
```

`music` accepts a built-in track ID or an absolute path to any MP3/AAC file on your machine.

## Built-in tracks

| ID | Name | Vibe |
|---|---|---|
| `lofi-1` | Rainy Day | Lo-fi hip hop |
| `lofi-2` | Late Night | Chill beats |
| `ambient-1` | Forest | Nature ambient |
| `ambient-2` | Space | Synth pad |
| `chime` | Done Chime | Short bell |

## How it works

`claude-notify setup` adds this to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [{ "command": "claude-notify fire --duration=$CLAUDE_SESSION_DURATION" }]
  }
}
```

Every time Claude finishes, the hook fires, notification appears, music plays.

## Requirements

- macOS (uses `afplay` for audio, macOS notifications)
- Node.js 18+
