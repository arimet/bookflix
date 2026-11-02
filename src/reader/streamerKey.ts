// Shared by the page and the service worker: where an EPUB being read is parked and served.
import type { Direction } from '../sync/books'

export const STREAMER_PATH = `${import.meta.env.BASE_URL}streamer/`
export const OPEN_CACHE = 'bookflix-open'
export const openCacheUrl = (key: string) => `${import.meta.env.BASE_URL}open/${key}`

const toBase64Url = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromBase64Url = (s: string) =>
  new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)))

// The nonce makes each open its own entry, so closing one open never removes a book another open still reads.
export const openKey = (bookId: string, direction: Direction, nonce = crypto.randomUUID().slice(0, 8)) =>
  toBase64Url(`${direction}|${nonce}|${bookId}`)

export function parseOpenKey(key: string): { bookId: string; direction: Direction } {
  const [direction, , ...rest] = fromBase64Url(key).split('|')
  return { bookId: rest.join('|'), direction: direction as Direction }
}
