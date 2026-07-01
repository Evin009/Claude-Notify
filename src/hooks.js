'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOK_COMMAND = 'claude-notify fire --duration=$CLAUDE_SESSION_DURATION';

function settingsPath() {
  return path.join(os.homedir(), '.claude', 'settings.json');
}

function readSettings() {
  const p = settingsPath();
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeSettings(settings) {
  const p = settingsPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(settings, null, 2));
}

function hookInstalled() {
  const settings = readSettings();
  const stops = Array.isArray(settings?.hooks?.Stop) ? settings.hooks.Stop : [];
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
  if (!Array.isArray(settings?.hooks?.Stop)) return;
  settings.hooks.Stop = settings.hooks.Stop.filter(
    h => !(h.command && h.command.includes('claude-notify'))
  );
  writeSettings(settings);
}

module.exports = { patchHook, removeHook, hookInstalled, HOOK_COMMAND };
