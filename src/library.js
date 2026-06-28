'use strict';

const TRACKS = {};

function resolveTrackPath(trackId) {
  return TRACKS[trackId] || null;
}

module.exports = { resolveTrackPath, TRACKS };
