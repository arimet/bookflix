import { expect, test } from 'vitest'
import { isDoubleTap, zoomedLook } from './pageZoom'

test('a double tap is a second tap soon after the first, close to it', () => {
  const first = { time: 1000, x: 100, y: 100 }
  expect(isDoubleTap(first, { time: 1200, x: 110, y: 95 })).toBe(true)
  expect(isDoubleTap(first, { time: 1400, x: 100, y: 100 })).toBe(false) // too late
  expect(isDoubleTap(first, { time: 1200, x: 200, y: 100 })).toBe(false) // too far
  expect(isDoubleTap(undefined, first)).toBe(false)
})

test('zoomedLook puts each point of the surface where the zoomed view showed it', () => {
  const view = { scale: 2, offsetLeft: 100, offsetTop: 300 }
  const origin = { x: 0, y: 50 } // a surface below a 50 px status bar
  const [, x, y, scale] = zoomedLook(view, origin).match(/translate\((.+)px, (.+)px\) scale\((.+)\)/)!.map(Number)
  const shown = (p: { x: number; y: number }) => ({ x: origin.x + x + scale * (p.x - origin.x), y: origin.y + y + scale * (p.y - origin.y) })
  const zoomed = (p: { x: number; y: number }) => ({ x: (p.x - view.offsetLeft) * view.scale, y: (p.y - view.offsetTop) * view.scale })
  for (const p of [{ x: 150, y: 400 }, { x: 0, y: 50 }, { x: 390, y: 844 }]) expect(shown(p)).toEqual(zoomed(p))
})
