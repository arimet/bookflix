import { createArchiveFromZipJs } from '@prose-reader/archive-reader/archives/createArchiveFromZipJs'
import { configure, Reader, ZipReader } from '@zip.js/zip.js'
import { downloadBookRange } from '../dropbox/api'
import type { Book } from '../library/library'

// Entries are small, mostly stored images: inflating on the main thread is fine and avoids worker setup.
configure({ useWebWorkers: false })

type ReadRange = (start: number, length: number) => Promise<Uint8Array>

class RangeReader extends Reader<null> {
  private read: ReadRange
  constructor(size: number, read: ReadRange) {
    super(null)
    this.size = size
    this.read = read
  }
  readUint8Array(index: number, length: number) {
    return this.read(index, length)
  }
}

export const openRemoteZip = (size: number, read: ReadRange) => new ZipReader(new RangeReader(size, read))

const BLOCK = 1024 * 1024
const MAX_BLOCKS = 48 // ~48 MB kept per open book

// Each Dropbox request costs a round trip, often more than the transfer itself. zip.js asks for a
// 30-byte entry header, then the entry data, then the next header… Reading whole 1 MB blocks and
// keeping them serves those from one request, and usually the next pages too.
export function blockReader(size: number, blockSize: number, read: ReadRange): ReadRange {
  const blocks = new Map<number, Promise<Uint8Array>>()

  const fetchRun = (first: number, last: number) => {
    const start = first * blockSize
    const run = read(start, Math.min(size, (last + 1) * blockSize) - start)
    for (let b = first; b <= last; b++) {
      const offset = (b - first) * blockSize
      blocks.set(b, run.then((bytes) => bytes.subarray(offset, offset + blockSize)))
      if (blocks.size > MAX_BLOCKS) blocks.delete(blocks.keys().next().value!) // oldest first
    }
  }

  return async (start, length) => {
    const first = Math.floor(start / blockSize)
    const last = Math.floor((start + length - 1) / blockSize)
    let missing: number | null = null
    for (let b = first; b <= last + 1; b++) {
      if (b <= last && !blocks.has(b)) missing ??= b
      else if (missing !== null) {
        fetchRun(missing, b - 1)
        missing = null
      }
    }
    const parts = await Promise.all(Array.from({ length: last - first + 1 }, (_, i) => blocks.get(first + i)!))
    const out = new Uint8Array(length)
    let written = 0
    parts.forEach((part, i) => {
      const from = i === 0 ? start - first * blockSize : 0
      const chunk = part.subarray(from, from + (length - written))
      out.set(chunk, written)
      written += chunk.length
    })
    return out
  }
}

// A CBZ or EPUB read straight from Dropbox: only the zip directory and the entries asked for are fetched.
// The first pages sit at the start of the file and the directory at its end: both are asked for at once,
// instead of the first page waiting for the directory (one Dropbox round trip less to open a book).
export const createRemoteArchive = (book: Book) => {
  const read = blockReader(book.file.size, BLOCK, (start, length) => downloadBookRange(book.id, start, length))
  read(0, 1).catch(() => {}) // ponytail: also fetched when resuming further in; 1 MB wasted then
  return createArchiveFromZipJs(openRemoteZip(book.file.size, read), {
    name: book.file.name,
    encodingFormat: book.format === 'cbz' ? 'application/vnd.comicbook+zip' : 'application/epub+zip',
  })
}
