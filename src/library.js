'use strict';

const path = require('path');

const MUSIC_DIR = path.join(__dirname, '..', 'music');

const TRACKS = {
  'lofi-1':    { name: 'Rainy Day',  vibe: 'Lo-fi hip hop',  file: 'lofi-1.mp3' },
  'lofi-2':    { name: 'Late Night', vibe: 'Chill beats',     file: 'lofi-2.mp3' },
  'ambient-1': { name: 'Forest',     vibe: 'Nature ambient',  file: 'ambient-1.mp3' },
  'ambient-2': { name: 'Space',      vibe: 'Synth pad',       file: 'ambient-2.mp3' },
  'chime':     { name: 'Done Chime', vibe: 'Short bell',      file: 'chime.mp3' },
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
