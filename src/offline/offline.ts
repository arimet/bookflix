import { downloadBook } from '../dropbox/api'
import type { Book } from '../library/library'

const CACHE = 'bookflix-books'
// The rev in the key means an updated file in Dropbox is a cache miss, never a stale read.
const key = (book: Book) => `/book/${encodeURIComponent(book.id)}?rev=${book.file.rev}`
const idOf = (url: string) => decodeURIComponent(new URL(url).pathname.replace('/book/', ''))

const RECENT_CACHE = 'bookflix-recent'
const RECENT_COUNT = 3

// A saved-offline copy, or one of the last books opened: reopening those costs no download.
export async function localBookBlob(book: Book): Promise<Blob | null> {
  for (const name of [CACHE, RECENT_CACHE]) {
    const hit = await (await caches.open(name)).match(key(book))
    if (hit) return hit.blob()
  }
  return null
}

export async function getBookBlob(book: Book): Promise<Blob> {
  const local = await localBookBlob(book)
  if (local) return local
  const blob = await downloadBook(book.id)
  const recent = await caches.open(RECENT_CACHE)
  await recent.put(key(book), new Response(blob))
  const keys = await recent.keys() // insertion order: oldest first
  for (const old of keys.slice(0, -RECENT_COUNT)) await recent.delete(old)
  return blob
}

export async function saveOffline(book: Book): Promise<void> {
  const blob = await downloadBook(book.id)
  await removeOffline(book)
  await (await caches.open(CACHE)).put(key(book), new Response(blob))
}

export async function removeOffline(book: Book): Promise<void> {
  const cache = await caches.open(CACHE)
  for (const req of await cache.keys()) if (idOf(req.url) === book.id) await cache.delete(req)
}

export async function listOffline(): Promise<Set<string>> {
  return new Set((await (await caches.open(CACHE)).keys()).map((req) => idOf(req.url)))
}
