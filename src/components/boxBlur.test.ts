import { expect, test } from 'vitest'
import { boxBlur } from './boxBlur'

const image = (w: number, h: number, pixel: (x: number, y: number) => number) => {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = pixel(x, y)
    data.set([v, v, v, 255], (y * w + x) * 4)
  }
  return data
}

test('a flat image stays flat', () => {
  const data = image(8, 8, () => 120)
  boxBlur(data, 8, 8, 2)
  expect(new Set(data.filter((_, i) => i % 4 === 0))).toEqual(new Set([120]))
})

test('a hard edge becomes a gradient', () => {
  const data = image(10, 1, (x) => (x < 5 ? 0 : 250))
  boxBlur(data, 10, 1, 2)
  const row = [...data.filter((_, i) => i % 4 === 0)]
  expect(row[4]).toBeGreaterThan(0)
  expect(row[5]).toBeLessThan(250)
  expect(row[0]).toBeLessThan(row[9])
  expect(data[3]).toBe(255) // alpha untouched
})
