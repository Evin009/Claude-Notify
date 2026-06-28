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
