const fs = require('fs');
const os = require('os');
const path = require('path');

const mockHome = fs.mkdtempSync(path.join(os.tmpdir(), 'cn-test-'));
jest.spyOn(os, 'homedir').mockReturnValue(mockHome);

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
