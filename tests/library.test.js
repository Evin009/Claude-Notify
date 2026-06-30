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
