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
