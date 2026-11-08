import { expect, test } from 'vitest'
import { clampView, restingScale, settle, zoomAround, zoomFrame } from './stripZoom'

// Where a strip point shows in the box through a view.
const onScreen = (view: { scale: number; x: number; y: number }, p: { x: number; y: number }) =>
  ({ x: (p.x - view.x) * view.scale, y: (p.y - view.y) * view.scale })

test('zoomAround keeps the point under the finger in place', () => {
  const start = { scale: 1, x: 0, y: 1000 }
  const at = { x: 100, y: 300 }
  const zoomed = zoomAround(start, 2.5, at)
  expect(onScreen(zoomed, { x: 100, y: 1300 })).toEqual(at)
  expect(onScreen(zoomAround(zoomed, 1, at), { x: 100, y: 1300 })).toEqual(at)
})

test('clampView leaves no blank past the edges of the strip', () => {
  const strip = { width: 390, height: 5000 }
  const box = { width: 390, height: 664 }
  expect(clampView({ scale: 1, x: 40, y: -20 }, strip, box)).toEqual({ scale: 1, x: 0, y: 0 })
  expect(clampView({ scale: 2, x: 300, y: 4900 }, strip, box)).toEqual({ scale: 2, x: 195, y: 4668 })
})

test('a zoom rests between 1 and 4, and eases out', () => {
  expect(restingScale(0.8)).toBe(1)
  expect(restingScale(5)).toBe(4)
  expect(settle(0)).toBe(0)
  expect(settle(1)).toBe(1)
  expect(settle(0.5)).toBeGreaterThan(0.5)
})

test('zoomFrame starts at the start, ends at the target, and keeps the finger point in between', () => {
  const start = { scale: 2.5, x: 60, y: 1180 }
  const at = { x: 100, y: 300 }
  const target = clampView(zoomAround(start, 1, at), { width: 390, height: 5000 }, { width: 390, height: 664 })
  expect(zoomFrame(start, 1, at, target, 0)).toEqual(start)
  expect(zoomFrame(start, 1, at, target, 1)).toEqual(target)
  const middle = zoomFrame(start, 1, at, target, 0.5)
  const point = { x: start.x + at.x / start.scale, y: start.y + at.y / start.scale }
  expect(onScreen(middle, point).y).toBeCloseTo(at.y) // not moved back vertically: stays under the finger
})
