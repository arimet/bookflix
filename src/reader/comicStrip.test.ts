import { expect, test } from 'vitest'
import { pageAt, pageCfi, pageOfCfi, stripPercent } from './comicStrip'

test("a page's CFI and back, prose-reader's own included", () => {
  expect(pageCfi(0, 'p00.png')).toBe('epubcfi(/6/2[p00.png]!)')
  expect(pageOfCfi(pageCfi(9, 'p09.png'), 40)).toBe(9)
  expect(pageOfCfi('epubcfi(/6/22[p10.png]!/4/2:0)', 40)).toBe(10)
  expect(pageOfCfi(undefined, 40)).toBe(0)
  expect(pageOfCfi('epubcfi(/6/200[x]!)', 40)).toBe(39) // a page that no longer exists
})

test('the share read reaches 1 at the bottom of the last page only', () => {
  expect(stripPercent(10, 40, false)).toBe(0.25)
  expect(stripPercent(39, 40, false)).toBe(0.975)
  expect(stripPercent(39, 40, true)).toBe(1)
})

test('pageAt finds the page under a height', () => {
  const tops = [0, 500, 1000, 1800]
  expect(pageAt(tops, 0)).toBe(0)
  expect(pageAt(tops, 499)).toBe(0)
  expect(pageAt(tops, 500)).toBe(1)
  expect(pageAt(tops, 5000)).toBe(3)
})
