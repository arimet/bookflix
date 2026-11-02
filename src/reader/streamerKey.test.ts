import { expect, test } from 'vitest'
import { openKey, parseOpenKey } from './streamerKey'

test('openKey is a URL-safe path segment that round-trips', () => {
  const key = openKey('id:a4ayc_80_OEAAAAAAAAAXw', 'rtl')
  expect(key).toMatch(/^[A-Za-z0-9_-]+$/)
  expect(parseOpenKey(key)).toEqual({ bookId: 'id:a4ayc_80_OEAAAAAAAAAXw', direction: 'rtl' })
})

test('openKey differs by direction so the service worker never reuses a stale manifest', () => {
  expect(openKey('id:x', 'ltr')).not.toBe(openKey('id:x', 'rtl'))
})
