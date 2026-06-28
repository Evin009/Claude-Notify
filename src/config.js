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
