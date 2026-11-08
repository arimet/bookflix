import { expect, test } from 'vitest'
import { isDoubleTap } from './pageZoom'

test('a double tap is a second tap soon after the first, close to it', () => {
  const first = { time: 1000, x: 100, y: 100 }
  expect(isDoubleTap(first, { time: 1200, x: 110, y: 95 })).toBe(true)
  expect(isDoubleTap(first, { time: 1400, x: 100, y: 100 })).toBe(false) // too late
  expect(isDoubleTap(first, { time: 1200, x: 200, y: 100 })).toBe(false) // too far
  expect(isDoubleTap(undefined, first)).toBe(false)
})
