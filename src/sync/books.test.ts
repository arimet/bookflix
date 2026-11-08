import { expect, test } from 'vitest'
import { defaultDirection, withBookSetting } from './books'

test('defaultDirection: comics right to left, the rest left to right', () => {
  expect(defaultDirection('cbz')).toBe('rtl')
  expect(defaultDirection('cbr')).toBe('rtl')
  expect(defaultDirection('epub')).toBe('ltr')
  expect(defaultDirection('pdf')).toBe('ltr')
})

test("withBookSetting changes one setting of a book, keeping its others and the other books'", () => {
  const settings = { a: { direction: 'rtl' as const }, b: { flow: 'scroll' as const } }
  expect(withBookSetting(settings, 'a', { flow: 'scroll' })).toEqual({ a: { direction: 'rtl', flow: 'scroll' }, b: { flow: 'scroll' } })
  expect(withBookSetting(settings, 'c', { direction: 'ltr' })).toEqual({ ...settings, c: { direction: 'ltr' } })
})
