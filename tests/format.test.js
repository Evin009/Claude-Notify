const { formatDuration } = require('../src/format');

test('formats 0 seconds', () => {
  expect(formatDuration(0)).toBe('');
});

test('formats seconds only', () => {
  expect(formatDuration(45)).toBe('45s');
});

test('formats minutes and seconds', () => {
  expect(formatDuration(154)).toBe('2m 34s');
});

test('formats exact minutes', () => {
  expect(formatDuration(120)).toBe('2m 0s');
});

test('formats large values', () => {
  expect(formatDuration(3661)).toBe('61m 1s');
});
