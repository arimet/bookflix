import { downloadBook, fetchBook } from '../dropbox/api'
import type { Book } from '../library/library'

// Downloads made before the files below; still read, listed and removed.
const CACHE = 'bookflix-books'
// The rev in the key means an updated file in Dropbox is a cache miss, never a stale read.
const key = (book: Book) => `/book/${encodeURIComponent(book.id)}?rev=${book.file.rev}`
const idOf = (url: string) => decodeURIComponent(new URL(url).pathname.replace('/book/', ''))

// Downloads are files in the origin private file system, written as the bytes arrive and read by slices from
// disk. Safari holds a whole Cache Storage entry in memory before storing it: an 850 MB comic killed the page.
const DIR = 'books'
const fileName = (book: Book) => `${encodeURIComponent(book.id)}@${book.file.rev}` // "@" is escaped in the id
const idOfName = (name: string) => decodeURIComponent(name.slice(0, name.lastIndexOf('@')))
const booksDir = async () => (await navigator.storage.getDirectory()).getDirectoryHandle(DIR, { create: true })
const canWriteFiles = () => typeof FileSystemFileHandle !== 'undefined' && 'createWritable' in FileSystemFileHandle.prototype

const RECENT_CACHE = 'bookflix-recent'
const RECENT_COUNT = 3

// An empty file is a download the page did not live to finish: the bytes only land when the file is closed.
async function savedFile(book: Book): Promise<File | null> {
  if (!canWriteFiles()) return null
  try {
    const file = await (await (await booksDir()).getFileHandle(fileName(book))).getFile()
    return file.size ? file : null
  } catch {
    return null
  }
}

// A saved-offline copy, or one of the last books opened: reopening those costs no download.
export async function localBookBlob(book: Book): Promise<Blob | null> {
  const file = await savedFile(book)
  if (file) return file
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

// Streamed to disk: a big comic never sits whole in memory. onProgress gets the share downloaded, from 0 to 1.
export async function saveOffline(book: Book, onProgress: (share: number) => void = () => {}): Promise<void> {
  const res = await fetchBook(book.id)
  let loaded = 0
  const body = res.body!.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, out) {
      loaded += chunk.length
      onProgress(Math.min(1, loaded / book.file.size))
      out.enqueue(chunk)
    },
  }))
  await removeOffline(book)
  // Older Safari (before 26) cannot write a file from the page: the cache, fine for books of a reasonable size.
  if (!canWriteFiles()) return (await caches.open(CACHE)).put(key(book), new Response(body))
  const dir = await booksDir()
  const handle = await dir.getFileHandle(fileName(book), { create: true })
  try {
    await body.pipeTo(await handle.createWritable())
  } catch (e) {
    await dir.removeEntry(fileName(book)).catch(() => {})
    throw e
  }
}

export async function removeOffline(book: Book): Promise<void> {
  const cache = await caches.open(CACHE)
  for (const req of await cache.keys()) if (idOf(req.url) === book.id) await cache.delete(req)
  if (!canWriteFiles()) return
  const dir = await booksDir()
  for await (const entry of dir.values()) if (idOfName(entry.name) === book.id) await dir.removeEntry(entry.name)
}

export async function listOffline(): Promise<Set<string>> {
  const ids = new Set((await (await caches.open(CACHE)).keys()).map((req) => idOf(req.url)))
  if (!canWriteFiles()) return ids
  for await (const entry of (await booksDir()).values()) {
    if (entry.kind === 'file' && (await (entry as FileSystemFileHandle).getFile()).size) ids.add(idOfName(entry.name))
  }
  return ids
}
