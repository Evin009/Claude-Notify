jest.mock('node-notifier');
jest.mock('../src/config');
jest.mock('../src/player');

const notifier = require('node-notifier');
const { readConfig } = require('../src/config');
const { play } = require('../src/player');
const { fire } = require('../src/notify');

beforeEach(() => {
  jest.clearAllMocks();
  notifier.notify = jest.fn();
  play.mockResolvedValue(undefined);
});

test('sends notification with duration when enabled', async () => {
  readConfig.mockReturnValue({ enabled: true, music: null, musicDuration: 0, volume: 80 });
  await fire(154);
  expect(notifier.notify).toHaveBeenCalledWith(
    expect.objectContaining({ message: 'Claude done · 2m 34s' })
  );
});

test('sends notification without duration when duration is 0', async () => {
  readConfig.mockReturnValue({ enabled: true, music: null, musicDuration: 0, volume: 80 });
  await fire(0);
  expect(notifier.notify).toHaveBeenCalledWith(
    expect.objectContaining({ message: 'Claude done' })
  );
});

test('does nothing when disabled', async () => {
  readConfig.mockReturnValue({ enabled: false, music: null, musicDuration: 0, volume: 80 });
  await fire(30);
  expect(notifier.notify).not.toHaveBeenCalled();
});

test('calls play when music configured', async () => {
  readConfig.mockReturnValue({ enabled: true, music: 'lofi-1', musicDuration: 15, volume: 80 });
  await fire(30);
  expect(play).toHaveBeenCalledWith('lofi-1', 15, 80);
});

test('skips play when musicDuration is 0', async () => {
  readConfig.mockReturnValue({ enabled: true, music: 'lofi-1', musicDuration: 0, volume: 80 });
  await fire(30);
  expect(play).not.toHaveBeenCalled();
});
