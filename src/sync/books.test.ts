import { expect, test } from 'vitest'
import { defaultDirection } from './books'

test('defaultDirection: comics right to left, the rest left to right', () => {
  expect(defaultDirection('cbz')).toBe('rtl')
  expect(defaultDirection('cbr')).toBe('rtl')
  expect(defaultDirection('epub')).toBe('ltr')
  expect(defaultDirection('pdf')).toBe('ltr')
})
