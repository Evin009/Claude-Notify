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
    // never crash — audio is bonus only
  }
}

module.exports = { play };
