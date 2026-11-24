import { expect, test } from 'vitest'
import { bookSetting, defaultDirection, withBookSetting } from './books'

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

test('bookSetting: what a volume has not set comes from the volume of its series read last', () => {
  const at = (updatedAt: number) => ({ cfi: 'c', percent: 1, updatedAt, device: 'Mac' })
  const volumes = ['t1', 't2', 't3']
  const settings = { t1: { direction: 'ltr' as const, flow: 'pages' as const }, t2: { flow: 'scroll' as const } }
  const progress = { t1: at(1), t2: at(5) }
  // T3, never set: the scroll of T2 (read last), the direction of T1 (the only one that has it)
  expect(bookSetting(settings, 't3', volumes, progress)).toEqual({ direction: 'ltr', flow: 'scroll' })
  // T1 read last: its own flow wins
  expect(bookSetting(settings, 't3', volumes, { t1: at(9), t2: at(5) })).toEqual({ direction: 'ltr', flow: 'pages' })
  // A volume's own setting is kept
  expect(bookSetting(settings, 't1', volumes, progress)).toEqual({ direction: 'ltr', flow: 'pages' })
  // Outside a series, nothing to inherit
  expect(bookSetting(settings, 'dune', [], progress)).toEqual({})
})
