# Claude-Notify Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Node.js CLI that hooks into Claude Code's Stop event to fire a macOS notification and optionally play music when a task completes.

**Architecture:** Claude Code Stop hook calls `claude-notify fire --duration=<s>`. The CLI reads `~/.claude-notify.json`, sends a notification via `node-notifier`, and plays audio via `afplay` for a user-configured duration. A TUI wizard (`claude-notify setup`) handles first-time config and auto-patches Claude Code's `settings.json`.

**Tech Stack:** Node.js 18+, Commander.js (CLI parsing), Inquirer.js (TUI wizard), node-notifier (macOS notifications), afplay (macOS built-in audio), Jest (tests)

## Global Constraints

- macOS only — `afplay` and `node-notifier` Mac-style notifications required
- Node.js >= 18
- Config lives at `~/.claude-notify.json`
- Claude Code settings at `~/.claude/settings.json`
- Music files: MP3 or AAC only (afplay compatible)
- All audio errors must be silent at fire-time (never crash the hook)
- `claude-notify fire` must exit 0 always — a crashing hook breaks Claude Code

---

## File Map

| File | Responsibility |
|---|---|
| `bin/claude-notify` | Shebang entrypoint, wires Commander commands |
| `src/config.js` | Read/write/default `~/.claude-notify.json` |
| `src/notify.js` | Send macOS notification via node-notifier |
| `src/player.js` | Spawn afplay, enforce duration, handle errors silently |
| `src/library.js` | Built-in track metadata + resolve track path |
| `src/wizard.js` | Inquirer TUI, preview audio, write config, patch hooks |
| `src/hooks.js` | Read/write `~/.claude/settings.json` Stop hook entry |
| `src/format.js` | Format seconds → "2m 34s" string |
| `tests/config.test.js` | Unit tests for config read/write/defaults |
| `tests/notify.test.js` | Unit tests for notification formatting |
| `tests/player.test.js` | Unit tests for player spawn + kill logic |
| `tests/format.test.js` | Unit tests for duration formatter |
| `tests/hooks.test.js` | Unit tests for hooks read/write/patch |
| `music/` | Bundled MP3 clips (lofi-1, lofi-2, ambient-1, ambient-2, chime) |

---

## Phase 1 — Scaffold

### Task 1: Project setup

**Files:**
- Create: `package.json`
- Create: `bin/claude-notify`
- Create: `src/format.js`
- Create: `tests/format.test.js`

**Interfaces:**
- Produces: `formatDuration(seconds: number): string` — exported from `src/format.js`

- [x] **Step 1: Create project folder and init**

```bash
mkdir claude-notify && cd claude-notify
npm init -y
```

- [x] **Step 2: Install dependencies**

```bash
npm install commander node-notifier inquirer
npm install --save-dev jest
```

- [x] **Step 3: Update package.json**

Replace the generated `package.json` with:

```json
{
  "name": "claude-notify",
  "version": "1.0.0",
  "description": "macOS notifications + music for Claude Code task completion",
  "main": "src/index.js",
  "bin": {
    "claude-notify": "./bin/claude-notify"
  },
  "scripts": {
    "test": "jest --testEnvironment node"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "inquirer": "^9.0.0",
    "node-notifier": "^10.0.0"
  },
  "devDependencies": {
    "jest": "^29.0.0"
  },
  "engines": {
    "node": ">=18"
  }
}
```

- [x] **Step 4: Create bin entrypoint**

Create `bin/claude-notify`:

```javascript
#!/usr/bin/env node
'use strict';

const { program } = require('commander');

program
  .name('claude-notify')
  .description('macOS notifications + music when Claude Code finishes')
  .version('1.0.0');

program
  .command('fire')
  .description('Fire notification (called by Claude Code Stop hook)')
  .option('--duration <seconds>', 'Task duration in seconds', '0')
  .action(async (opts) => {
    const { fire } = require('../src/notify');
    await fire(parseInt(opts.duration, 10));
  });

program
  .command('setup')
  .description('Interactive setup wizard')
  .action(async () => {
    const { runWizard } = require('../src/wizard');
    await runWizard();
  });

program
  .command('config')
  .description('Print current config')
  .action(() => {
    const { readConfig } = require('../src/config');
    console.log(JSON.stringify(readConfig(), null, 2));
  });

program
  .command('enable')
  .description('Enable notifications')
  .action(() => {
    const { writeConfig, readConfig } = require('../src/config');
    writeConfig({ ...readConfig(), enabled: true });
    console.log('claude-notify enabled');
  });

program
  .command('disable')
  .description('Disable notifications without removing hook')
  .action(() => {
    const { writeConfig, readConfig } = require('../src/config');
    writeConfig({ ...readConfig(), enabled: false });
    console.log('claude-notify disabled');
  });

program.parse(process.argv);
```

- [x] **Step 5: Make bin executable**

```bash
chmod +x bin/claude-notify
```

- [x] **Step 6: Write failing test for format.js**

Create `tests/format.test.js`:

```javascript
const { formatDuration } = require('../src/format');

test('formats 0 seconds', () => {
  expect(formatDuration(0)).toBe('');
});

test('formats seconds only', () => {
  expect(formatDuration(45)).toBe('45s');
});

test('formats minutes and seconds', () => {
  expect(formatDuration(154)).toBe('2m 34s');
});

test('formats exact minutes', () => {
  expect(formatDuration(120)).toBe('2m 0s');
});

test('formats large values', () => {
  expect(formatDuration(3661)).toBe('61m 1s');
});
```

- [x] **Step 7: Run test — verify it fails**

```bash
npx jest tests/format.test.js
```

Expected: `Cannot find module '../src/format'`

- [x] **Step 8: Implement format.js**

Create `src/format.js`:

```javascript
'use strict';

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

module.exports = { formatDuration };
```

- [x] **Step 9: Run test — verify pass**

```bash
npx jest tests/format.test.js
```

Expected: `5 passed`

- [x] **Step 10: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold claude-notify project with format utility"
```

---

## Phase 2 — Config

### Task 2: Config read/write with defaults

**Files:**
- Create: `src/config.js`
- Create: `tests/config.test.js`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `readConfig(): Config` — returns config merged with defaults
  - `writeConfig(config: Config): void` — writes full config to disk
  - `Config` shape: `{ enabled: boolean, music: string|null, musicDuration: number, volume: number }`

- [x] **Step 1: Write failing tests**

Create `tests/config.test.js`:

```javascript
const fs = require('fs');
const os = require('os');
const path = require('path');
const { readConfig, writeConfig, DEFAULT_CONFIG } = require('../src/config');

const CONFIG_PATH = path.join(os.homedir(), '.claude-notify.json');

beforeEach(() => {
  if (fs.existsSync(CONFIG_PATH)) fs.unlinkSync(CONFIG_PATH);
});

afterEach(() => {
  if (fs.existsSync(CONFIG_PATH)) fs.unlinkSync(CONFIG_PATH);
});

test('returns defaults when no config file exists', () => {
  const config = readConfig();
  expect(config).toEqual(DEFAULT_CONFIG);
});

test('reads existing config and merges with defaults', () => {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({ enabled: false, volume: 50 }));
  const config = readConfig();
  expect(config.enabled).toBe(false);
  expect(config.volume).toBe(50);
  expect(config.musicDuration).toBe(DEFAULT_CONFIG.musicDuration);
});

test('writeConfig writes valid JSON to disk', () => {
  writeConfig({ enabled: true, music: 'lofi-1', musicDuration: 20, volume: 70 });
  const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  expect(raw.music).toBe('lofi-1');
  expect(raw.musicDuration).toBe(20);
});

test('readConfig handles corrupt JSON gracefully', () => {
  fs.writeFileSync(CONFIG_PATH, 'not json {{');
  const config = readConfig();
  expect(config).toEqual(DEFAULT_CONFIG);
});
```

- [x] **Step 2: Run test — verify fail**

```bash
npx jest tests/config.test.js
```

Expected: `Cannot find module '../src/config'`

- [x] **Step 3: Implement config.js**

Create `src/config.js`:

```javascript
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const CONFIG_PATH = path.join(os.homedir(), '.claude-notify.json');

const DEFAULT_CONFIG = {
  enabled: true,
  music: null,
  musicDuration: 15,
  volume: 80,
};

function readConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function writeConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

module.exports = { readConfig, writeConfig, DEFAULT_CONFIG, CONFIG_PATH };
```

- [x] **Step 4: Run test — verify pass**

```bash
npx jest tests/config.test.js
```

Expected: `4 passed`

- [x] **Step 5: Commit**

```bash
git add src/config.js tests/config.test.js
git commit -m "feat: add config read/write with defaults"
```

---

## Phase 3 — Core Notification

### Task 3: macOS notification via node-notifier

**Files:**
- Create: `src/notify.js`
- Create: `tests/notify.test.js`

**Interfaces:**
- Consumes: `readConfig()` from `src/config.js`, `formatDuration(s)` from `src/format.js`
- Produces: `fire(durationSeconds: number): Promise<void>` — sends notification, triggers player if configured

- [x] **Step 1: Write failing tests**

Create `tests/notify.test.js`:

```javascript
jest.mock('node-notifier');
jest.mock('../src/config');
jest.mock('../src/player');

const notifier = require('node-notifier');
const { readConfig } = require('../src/config');
const { play } = require('../src/player');
const { fire } = require('../src/notify');

beforeEach(() => {
  jest.clearAllMocks();
  notifier.notify = jest.fn();
  play.mockResolvedValue(undefined);
});

test('sends notification with duration when enabled', async () => {
  readConfig.mockReturnValue({ enabled: true, music: null, musicDuration: 0, volume: 80 });
  await fire(154);
  expect(notifier.notify).toHaveBeenCalledWith(
    expect.objectContaining({ message: 'Claude done · 2m 34s' })
  );
});

test('sends notification without duration when duration is 0', async () => {
  readConfig.mockReturnValue({ enabled: true, music: null, musicDuration: 0, volume: 80 });
  await fire(0);
  expect(notifier.notify).toHaveBeenCalledWith(
    expect.objectContaining({ message: 'Claude done' })
  );
});

test('does nothing when disabled', async () => {
  readConfig.mockReturnValue({ enabled: false, music: null, musicDuration: 0, volume: 80 });
  await fire(30);
  expect(notifier.notify).not.toHaveBeenCalled();
});

test('calls play when music configured', async () => {
  readConfig.mockReturnValue({ enabled: true, music: 'lofi-1', musicDuration: 15, volume: 80 });
  await fire(30);
  expect(play).toHaveBeenCalledWith('lofi-1', 15, 80);
});

test('skips play when musicDuration is 0', async () => {
  readConfig.mockReturnValue({ enabled: true, music: 'lofi-1', musicDuration: 0, volume: 80 });
  await fire(30);
  expect(play).not.toHaveBeenCalled();
});
```

- [x] **Step 2: Run test — verify fail**

```bash
npx jest tests/notify.test.js
```

Expected: `Cannot find module '../src/notify'`

- [x] **Step 3: Create stub player.js so mock works**

Create `src/player.js` (stub — full implementation in Task 4):

```javascript
'use strict';

async function play(track, durationSeconds, volume) {}

module.exports = { play };
```

- [x] **Step 4: Implement notify.js**

Create `src/notify.js`:

```javascript
'use strict';

const notifier = require('node-notifier');
const { readConfig } = require('./config');
const { play } = require('./player');
const { formatDuration } = require('./format');

async function fire(durationSeconds) {
  const config = readConfig();
  if (!config.enabled) return;

  const dur = formatDuration(durationSeconds);
  const message = dur ? `Claude done · ${dur}` : 'Claude done';

  notifier.notify({
    title: 'Claude Notify',
    message,
    sound: false,
  });

  if (config.music && config.musicDuration > 0) {
    await play(config.music, config.musicDuration, config.volume);
  }
}

module.exports = { fire };
```

- [x] **Step 5: Run test — verify pass**

```bash
npx jest tests/notify.test.js
```

Expected: `5 passed`

- [x] **Step 6: Commit**

```bash
git add src/notify.js src/player.js tests/notify.test.js
git commit -m "feat: add core notification via node-notifier"
```

---

## Phase 4 — Audio Player

### Task 4: afplay wrapper with duration limit

**Files:**
- Modify: `src/player.js` (replace stub)
- Create: `tests/player.test.js`

**Interfaces:**
- Consumes: `resolveTrackPath(trackId: string): string` from `src/library.js`
- Produces: `play(track: string, durationSeconds: number, volume: number): Promise<void>`
  - `track` is either a built-in ID (`lofi-1`) or absolute file path
  - Resolves when audio finishes or duration expires
  - Never rejects — all errors caught silently

- [x] **Step 1: Write failing tests**

Create `tests/player.test.js`:

```javascript
jest.mock('child_process');
jest.mock('../src/library');

const { spawn } = require('child_process');
const { resolveTrackPath } = require('../src/library');
const { play } = require('../src/player');

function makeFakeProcess(exitCode = 0) {
  const proc = {
    kill: jest.fn(),
    on: jest.fn(),
    stderr: { on: jest.fn() },
  };
  proc.on.mockImplementation((event, cb) => {
    if (event === 'close') setTimeout(() => cb(exitCode), 10);
  });
  return proc;
}

beforeEach(() => {
  jest.clearAllMocks();
  resolveTrackPath.mockReturnValue('/fake/track.mp3');
});

test('spawns afplay with correct args', async () => {
  const proc = makeFakeProcess();
  spawn.mockReturnValue(proc);

  await play('lofi-1', 30, 80);

  expect(spawn).toHaveBeenCalledWith('afplay', [
    '/fake/track.mp3',
    '-v', '0.8',
  ]);
});

test('kills afplay after duration expires', async () => {
  jest.useFakeTimers();
  const proc = { kill: jest.fn(), on: jest.fn(), stderr: { on: jest.fn() } };
  proc.on.mockImplementation(() => {});
  spawn.mockReturnValue(proc);

  const promise = play('lofi-1', 5, 80);
  jest.advanceTimersByTime(5000);
  await promise;

  expect(proc.kill).toHaveBeenCalled();
  jest.useRealTimers();
});

test('resolves silently when afplay not found', async () => {
  spawn.mockImplementation(() => { throw new Error('spawn ENOENT'); });
  await expect(play('lofi-1', 5, 80)).resolves.toBeUndefined();
});

test('resolves silently when track file missing', async () => {
  resolveTrackPath.mockReturnValue(null);
  await expect(play('lofi-1', 5, 80)).resolves.toBeUndefined();
});
```

- [x] **Step 2: Run test — verify fail**

```bash
npx jest tests/player.test.js
```

Expected: `Cannot find module '../src/library'` or assertion failures

- [x] **Step 3: Create stub library.js**

Create `src/library.js` (stub — full implementation in Task 5):

```javascript
'use strict';

const TRACKS = {};

function resolveTrackPath(trackId) {
  return TRACKS[trackId] || null;
}

module.exports = { resolveTrackPath, TRACKS };
```

- [x] **Step 4: Implement player.js**

Replace `src/player.js`:

```javascript
'use strict';

const { spawn } = require('child_process');
const { resolveTrackPath } = require('./library');

async function play(trackId, durationSeconds, volume) {
  try {
    const trackPath = resolveTrackPath(trackId) || trackId;
    if (!trackPath) return;

    const vol = (Math.min(100, Math.max(0, volume)) / 100).toFixed(2);
    const proc = spawn('afplay', [trackPath, '-v', vol]);

    proc.stderr.on('data', () => {});

    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        proc.kill();
        resolve();
      }, durationSeconds * 1000);

      proc.on('close', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  } catch {
    // never crash the hook
  }
}

module.exports = { play };
```

- [x] **Step 5: Run test — verify pass**

```bash
npx jest tests/player.test.js
```

Expected: `4 passed`

- [x] **Step 6: Commit**

```bash
git add src/player.js src/library.js tests/player.test.js
git commit -m "feat: add afplay audio player with duration kill"
```

---

## Phase 5 — Music Library

### Task 5: Built-in track metadata and path resolution

**Files:**
- Modify: `src/library.js` (replace stub)
- Create: `music/` folder with placeholder README
- Create: `tests/library.test.js`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `resolveTrackPath(trackId: string): string|null`
  - `TRACKS: Record<string, { name: string, vibe: string, file: string }>`
  - `listTracks(): Array<{ id: string, name: string, vibe: string }>`

> **Note on music files:** Bundled MP3s are not included in this plan. Add royalty-free MP3 clips to `music/` named `lofi-1.mp3`, `lofi-2.mp3`, `ambient-1.mp3`, `ambient-2.mp3`, `chime.mp3`. Sources: freemusicarchive.org or pixabay.com/music (check license). The library resolves paths — missing files fall back to null silently.

- [x] **Step 1: Write failing tests**

Create `tests/library.test.js`:

```javascript
const path = require('path');
const { resolveTrackPath, listTracks, TRACKS } = require('../src/library');

test('TRACKS contains all 5 built-in entries', () => {
  const ids = Object.keys(TRACKS);
  expect(ids).toEqual(expect.arrayContaining(['lofi-1', 'lofi-2', 'ambient-1', 'ambient-2', 'chime']));
  expect(ids.length).toBe(5);
});

test('resolveTrackPath returns absolute path for built-in id', () => {
  const p = resolveTrackPath('lofi-1');
  expect(path.isAbsolute(p)).toBe(true);
  expect(p).toMatch(/lofi-1\.mp3$/);
});

test('resolveTrackPath returns the string as-is for custom absolute path', () => {
  const custom = '/Users/evin/music/banger.mp3';
  expect(resolveTrackPath(custom)).toBe(custom);
});

test('resolveTrackPath returns null for unknown id', () => {
  expect(resolveTrackPath('does-not-exist')).toBeNull();
});

test('listTracks returns id, name, vibe for each track', () => {
  const tracks = listTracks();
  expect(tracks.length).toBe(5);
  tracks.forEach(t => {
    expect(t).toHaveProperty('id');
    expect(t).toHaveProperty('name');
    expect(t).toHaveProperty('vibe');
  });
});
```

- [x] **Step 2: Run test — verify fail**

```bash
npx jest tests/library.test.js
```

Expected: assertion failures (stub has empty TRACKS)

- [x] **Step 3: Implement library.js**

Replace `src/library.js`:

```javascript
'use strict';

const path = require('path');

const MUSIC_DIR = path.join(__dirname, '..', 'music');

const TRACKS = {
  'lofi-1':    { name: 'Rainy Day',   vibe: 'Lo-fi hip hop',      file: 'lofi-1.mp3' },
  'lofi-2':    { name: 'Late Night',  vibe: 'Chill beats',         file: 'lofi-2.mp3' },
  'ambient-1': { name: 'Forest',      vibe: 'Nature ambient',      file: 'ambient-1.mp3' },
  'ambient-2': { name: 'Space',       vibe: 'Synth pad',           file: 'ambient-2.mp3' },
  'chime':     { name: 'Done Chime',  vibe: 'Short bell',          file: 'chime.mp3' },
};

function resolveTrackPath(trackId) {
  if (!trackId) return null;
  if (TRACKS[trackId]) return path.join(MUSIC_DIR, TRACKS[trackId].file);
  if (path.isAbsolute(trackId)) return trackId;
  return null;
}

function listTracks() {
  return Object.entries(TRACKS).map(([id, t]) => ({ id, name: t.name, vibe: t.vibe }));
}

module.exports = { resolveTrackPath, listTracks, TRACKS };
```

- [x] **Step 4: Create music folder with note**

```bash
mkdir -p music
echo "# Add royalty-free MP3s here: lofi-1.mp3, lofi-2.mp3, ambient-1.mp3, ambient-2.mp3, chime.mp3" > music/README.md
```

- [x] **Step 5: Run test — verify pass**

```bash
npx jest tests/library.test.js
```

Expected: `5 passed`

- [x] **Step 6: Commit**

```bash
git add src/library.js music/README.md tests/library.test.js
git commit -m "feat: add built-in music library with track resolution"
```

---

## Phase 6 — Hook Integration

### Task 6: Read/write Claude Code settings.json Stop hook

**Files:**
- Create: `src/hooks.js`
- Create: `tests/hooks.test.js`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `patchHook(): void` — adds Stop hook entry to `~/.claude/settings.json`, non-destructively
  - `removeHook(): void` — removes the claude-notify Stop hook entry
  - `hookInstalled(): boolean` — returns true if hook already present

- [x] **Step 1: Write failing tests**

Create `tests/hooks.test.js`:

```javascript
const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('os');
const mockHome = require('fs').mkdtempSync(require('os').tmpdir() + '/cn-test-');
os.homedir.mockReturnValue(mockHome);

const { patchHook, removeHook, hookInstalled } = require('../src/hooks');

const SETTINGS_PATH = path.join(mockHome, '.claude', 'settings.json');

beforeEach(() => {
  fs.rmSync(path.join(mockHome, '.claude'), { recursive: true, force: true });
  fs.mkdirSync(path.join(mockHome, '.claude'), { recursive: true });
});

test('hookInstalled returns false when settings.json missing', () => {
  expect(hookInstalled()).toBe(false);
});

test('patchHook creates settings.json with hook when missing', () => {
  patchHook();
  const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
  expect(settings.hooks.Stop).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ command: expect.stringContaining('claude-notify fire') })
    ])
  );
});

test('patchHook is idempotent — does not duplicate hook', () => {
  patchHook();
  patchHook();
  const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
  const hooks = settings.hooks.Stop.filter(h => h.command && h.command.includes('claude-notify'));
  expect(hooks.length).toBe(1);
});

test('patchHook preserves existing hooks', () => {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify({
    hooks: { Stop: [{ command: 'echo done' }] }
  }));
  patchHook();
  const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
  expect(settings.hooks.Stop.length).toBe(2);
});

test('removeHook removes only the claude-notify entry', () => {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify({
    hooks: {
      Stop: [
        { command: 'echo done' },
        { command: 'claude-notify fire --duration=$CLAUDE_SESSION_DURATION' }
      ]
    }
  }));
  removeHook();
  const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
  expect(settings.hooks.Stop.length).toBe(1);
  expect(settings.hooks.Stop[0].command).toBe('echo done');
});

test('hookInstalled returns true after patchHook', () => {
  patchHook();
  expect(hookInstalled()).toBe(true);
});
```

- [x] **Step 2: Run test — verify fail**

```bash
npx jest tests/hooks.test.js
```

Expected: `Cannot find module '../src/hooks'`

- [x] **Step 3: Implement hooks.js**

Create `src/hooks.js`:

```javascript
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');
const HOOK_COMMAND = 'claude-notify fire --duration=$CLAUDE_SESSION_DURATION';

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function writeSettings(settings) {
  const dir = path.dirname(SETTINGS_PATH);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

function hookInstalled() {
  const settings = readSettings();
  const stops = settings?.hooks?.Stop || [];
  return stops.some(h => h.command && h.command.includes('claude-notify'));
}

function patchHook() {
  if (hookInstalled()) return;
  const settings = readSettings();
  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.Stop) settings.hooks.Stop = [];
  settings.hooks.Stop.push({ command: HOOK_COMMAND });
  writeSettings(settings);
}

function removeHook() {
  const settings = readSettings();
  if (!settings?.hooks?.Stop) return;
  settings.hooks.Stop = settings.hooks.Stop.filter(
    h => !(h.command && h.command.includes('claude-notify'))
  );
  writeSettings(settings);
}

module.exports = { patchHook, removeHook, hookInstalled, HOOK_COMMAND };
```

- [x] **Step 4: Run test — verify pass**

```bash
npx jest tests/hooks.test.js
```

Expected: `6 passed`

- [x] **Step 5: Commit**

```bash
git add src/hooks.js tests/hooks.test.js
git commit -m "feat: add Claude Code settings.json hook patching"
```

---

## Phase 7 — TUI Wizard

### Task 7: Interactive setup wizard

**Files:**
- Modify: `src/wizard.js` (replace empty stub if exists, else create)

**Interfaces:**
- Consumes:
  - `writeConfig(config)` from `src/config.js`
  - `listTracks()` from `src/library.js`
  - `play(track, duration, volume)` from `src/player.js`
  - `patchHook()` from `src/hooks.js`
- Produces: `runWizard(): Promise<void>`

> Wizard is integration-heavy (Inquirer prompts + side effects). Manual test only — no unit tests for this task.

- [x] **Step 1: Implement wizard.js**

Create `src/wizard.js`:

```javascript
'use strict';

const inquirer = require('inquirer');
const { writeConfig } = require('./config');
const { listTracks } = require('./library');
const { play } = require('./player');
const { patchHook, hookInstalled } = require('./hooks');

async function runWizard() {
  console.log('\n🔔 Claude-Notify Setup\n');

  const { enabled } = await inquirer.prompt([{
    type: 'confirm',
    name: 'enabled',
    message: 'Enable notifications when Claude finishes?',
    default: true,
  }]);

  const { musicEnabled } = await inquirer.prompt([{
    type: 'confirm',
    name: 'musicEnabled',
    message: 'Play music when Claude finishes?',
    default: true,
  }]);

  let music = null;
  let musicDuration = 15;
  let volume = 80;

  if (musicEnabled) {
    const tracks = listTracks();
    const trackChoices = [
      ...tracks.map(t => ({ name: `${t.name} — ${t.vibe}`, value: t.id })),
      { name: 'Custom file (enter path)', value: '__custom__' },
    ];

    const { trackChoice } = await inquirer.prompt([{
      type: 'list',
      name: 'trackChoice',
      message: 'Choose a track (↑↓ to browse, Enter to preview):',
      choices: trackChoices,
    }]);

    if (trackChoice === '__custom__') {
      const { customPath } = await inquirer.prompt([{
        type: 'input',
        name: 'customPath',
        message: 'Absolute path to your MP3/AAC file:',
        validate: (v) => v.trim().length > 0 || 'Enter a file path',
      }]);
      music = customPath.trim();
    } else {
      music = trackChoice;
      console.log('  Playing 3s preview...');
      await play(music, 3, 80);
    }

    const { dur } = await inquirer.prompt([{
      type: 'number',
      name: 'dur',
      message: 'How many seconds should music play? (0 = full track)',
      default: 15,
      validate: (v) => v >= 0 || 'Must be 0 or greater',
    }]);
    musicDuration = dur;

    const { vol } = await inquirer.prompt([{
      type: 'number',
      name: 'vol',
      message: 'Volume (0–100):',
      default: 80,
      validate: (v) => (v >= 0 && v <= 100) || 'Must be 0–100',
    }]);
    volume = vol;
  }

  const config = { enabled, music, musicDuration, volume };
  writeConfig(config);
  console.log('\n✓ Config saved to ~/.claude-notify.json');

  if (!hookInstalled()) {
    const { patch } = await inquirer.prompt([{
      type: 'confirm',
      name: 'patch',
      message: 'Add Stop hook to ~/.claude/settings.json automatically?',
      default: true,
    }]);
    if (patch) {
      patchHook();
      console.log('✓ Hook added to ~/.claude/settings.json');
    } else {
      console.log('\nAdd this manually to ~/.claude/settings.json:');
      console.log(JSON.stringify({
        hooks: { Stop: [{ command: 'claude-notify fire --duration=$CLAUDE_SESSION_DURATION' }] }
      }, null, 2));
    }
  } else {
    console.log('✓ Hook already installed');
  }

  console.log('\nSetup complete. Run claude-notify config to verify.\n');
}

module.exports = { runWizard };
```

- [x] **Step 2: Manual test — run wizard**

```bash
node bin/claude-notify setup
```

Expected: prompts appear, config written to `~/.claude-notify.json`, hook appears in `~/.claude/settings.json`

- [x] **Step 3: Manual test — fire command**

```bash
node bin/claude-notify fire --duration=154
```

Expected: macOS notification appears saying "Claude done · 2m 34s", music plays if configured

- [x] **Step 4: Manual test — other commands**

```bash
node bin/claude-notify config    # prints current config JSON
node bin/claude-notify disable   # sets enabled: false
node bin/claude-notify config    # shows enabled: false
node bin/claude-notify enable    # sets enabled: true
```

- [x] **Step 5: Run full test suite to confirm no regressions**

```bash
npx jest
```

Expected: all tests pass

- [x] **Step 6: Install globally**

```bash
npm install -g .
claude-notify setup
```

- [x] **Step 7: Final commit**

```bash
git add src/wizard.js
git commit -m "feat: add TUI setup wizard with music preview and hook auto-patch"
```

---

## Full Test Run

```bash
npx jest --verbose
```

Expected output:
```
PASS tests/format.test.js (5 tests)
PASS tests/config.test.js (4 tests)
PASS tests/notify.test.js (5 tests)
PASS tests/player.test.js (4 tests)
PASS tests/library.test.js (5 tests)
PASS tests/hooks.test.js (6 tests)

Test Suites: 6 passed
Tests:       29 passed
```

---

## Phase Summary

| Phase | Tasks | Deliverable |
|---|---|---|
| 1 — Scaffold | Task 1 | Project structure, bin entrypoint, duration formatter |
| 2 — Config | Task 2 | `~/.claude-notify.json` read/write with defaults |
| 3 — Notify | Task 3 | macOS notification with duration string |
| 4 — Player | Task 4 | afplay wrapper, volume, auto-kill after duration |
| 5 — Library | Task 5 | Built-in track metadata, path resolution |
| 6 — Hooks | Task 6 | Claude Code `settings.json` Stop hook patch |
| 7 — Wizard | Task 7 | Interactive TUI setup, music preview, auto-wiring |
