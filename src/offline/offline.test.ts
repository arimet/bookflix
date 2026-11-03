import { expect, test, vi } from 'vitest'
import { fetchBook } from '../dropbox/api'
import type { Book } from '../library/library'
import { saveOffline } from './offline'

vi.mock('../dropbox/api', () => ({ fetchBook: vi.fn(), downloadBook: vi.fn() }))

test('saveOffline streams the book into the cache and reports its progress', async () => {
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
