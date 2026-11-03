import { expect, test, vi } from 'vitest'
import { fetchBook } from '../dropbox/api'
import type { Book } from '../library/library'
import { listOffline, localBookBlob, removeOffline, saveOffline } from './offline'

vi.mock('../dropbox/api', () => ({ fetchBook: vi.fn(), downloadBook: vi.fn() }))

test('without file writing (Safari before 26), saveOffline streams the book into the cache and reports its progress', async () => {
  const chunks = [new Uint8Array(3), new Uint8Array(1)]
  vi.mocked(fetchBook).mockResolvedValue(new Response(new ReadableStream({
    start(c) { chunks.forEach((chunk) => c.enqueue(chunk)); c.close() },
  })))
  const stored = new Map<string, Response>()
  vi.stubGlobal('caches', { open: async () => ({ keys: async () => [], put: async (key: string, res: Response) => void stored.set(key, res) }) })
  const book = { id: 'id:1', file: { size: 4, rev: 'r1' } } as Book
  const progress: number[] = []
  await saveOffline(book, (share) => progress.push(share))
  expect((await [...stored.values()][0].arrayBuffer()).byteLength).toBe(4)
  expect(progress).toEqual([0.75, 1])
  vi.unstubAllGlobals()
})

// The origin private file system, in memory: files whose bytes land when their writable is closed.
class FakeFileHandle {
  readonly kind = 'file'
  data = new Uint8Array()
  readonly name: string
  constructor(name: string) {
    this.name = name
  }
  async getFile() { return new File([this.data], this.name) }
  async createWritable() {
    const chunks: BlobPart[] = []
    return new WritableStream<Uint8Array<ArrayBuffer>>({
      write: (chunk) => void chunks.push(chunk),
      close: async () => void (this.data = new Uint8Array(await new Blob(chunks).arrayBuffer())),
    })
  }
}

test('saveOffline writes the book to a file that is listed, read and removed', async () => {
  const files = new Map<string, FakeFileHandle>()
  const dir = {
    getFileHandle: async (name: string, opts?: { create?: boolean }) => {
      if (!files.has(name) && opts?.create) files.set(name, new FakeFileHandle(name))
      const handle = files.get(name)
      if (!handle) throw new DOMException('missing', 'NotFoundError')
      return handle
    },
    removeEntry: async (name: string) => void files.delete(name),
    values: async function* () { yield* files.values() },
  }
  vi.stubGlobal('FileSystemFileHandle', FakeFileHandle)
  vi.stubGlobal('navigator', { storage: { getDirectory: async () => ({ getDirectoryHandle: async () => dir }) } })
  vi.stubGlobal('caches', { open: async () => ({ keys: async () => [], match: async () => undefined }) })
  vi.mocked(fetchBook).mockResolvedValue(new Response(new Uint8Array([1, 2, 3])))
  const book = { id: 'id:a@b', file: { size: 3, rev: 'r2' } } as Book

  await saveOffline(book)
  expect(await listOffline()).toEqual(new Set(['id:a@b']))
  expect(new Uint8Array(await (await localBookBlob(book))!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))
  // Not the size Dropbox gives: an incomplete copy, read from Dropbox instead.
  expect(await localBookBlob({ ...book, file: { ...book.file, size: 4 } })).toBeNull()

  // A download cut short leaves an empty file: not a book on the device.
  files.set('id%3Aother%40x@r1', new FakeFileHandle('id%3Aother%40x@r1'))
  expect(await listOffline()).toEqual(new Set(['id:a@b']))

  await removeOffline(book)
  expect(await listOffline()).toEqual(new Set())
  vi.unstubAllGlobals()
})
