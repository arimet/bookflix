import { DropboxError, downloadSync, upload } from '../dropbox/api'
import type { Book } from '../library/library'
import { localBookBlob } from '../offline/offline'
import { createRemoteArchive } from '../reader/remoteZip'
import { coverFromArchive, extractCover } from './extract'

const CACHE = 'bookflix-covers'
const NO_COVER_KEY = 'bookflix.noCover'
const remotePath = (book: Book) => `/covers/${book.id.replace('id:', '')}.jpg`
const cacheKey = (book: Book) => `/cover/${encodeURIComponent(book.id)}`
const noCover = (): string[] => JSON.parse(localStorage.getItem(NO_COVER_KEY) ?? '[]')

// Never downloads a whole book: a local copy is used when there is one, a CBZ or EPUB is read by
// ranges, and a PDF or CBR gets its cover once it has been opened on this device.
export async function findOrMakeCover(book: Book): Promise<Blob | null> {
  const cache = await caches.open(CACHE)
  const hit = await cache.match(cacheKey(book))
  if (hit) return hit.blob()
  if (noCover().includes(book.id)) return null
  let cover: Blob | null = null
  try {
    cover = await downloadSync(remotePath(book))
  } catch (e) {
    const missing = e instanceof DropboxError && e.message.startsWith('path/not_found')
    const local = await localBookBlob(book)
    // Dropbox unreachable: a copy on the device still gives a cover, kept here and shared next time.
    if (!missing && !local) throw e
    if (local) cover = await extractCover(local, book)
    else if (book.format === 'cbz' || book.format === 'epub') cover = await coverFromArchive(await createRemoteArchive(book), book)
    else return null
    if (!cover) {
      localStorage.setItem(NO_COVER_KEY, JSON.stringify([...noCover(), book.id]))
      return null
    }
    if (missing) await upload(remotePath(book), cover)
  }
  await cache.put(cacheKey(book), new Response(cover))
  return cover
}

// A few covers at a time: each costs a handful of small range requests.
const PARALLEL = 3
let running = 0
const waiting: (() => void)[] = []
const urls = new Map<string, Promise<string | null>>()

async function limited<T>(task: () => Promise<T>): Promise<T> {
  if (running >= PARALLEL) await new Promise<void>((resolve) => waiting.push(resolve))
  running++
  try {
    return await task()
  } finally {
    running--
    waiting.shift()?.()
  }
}

export function getCoverUrl(book: Book): Promise<string | null> {
  if (!urls.has(book.id)) {
    const url = limited(() => findOrMakeCover(book)).then((blob) => (blob ? URL.createObjectURL(blob) : null))
    urls.set(book.id, url.catch(() => null))
  }
  return urls.get(book.id)!
}
