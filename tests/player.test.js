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
    '-v', '0.80',
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
