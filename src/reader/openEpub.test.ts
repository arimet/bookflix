import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { openEpub } from './openEpub'

// Like the Cache API: keys are absolute URLs, entries can be addressed by string or Request.
const store = new Map<string, Response>()
const url = (k: string | Request) => new URL(typeof k === 'string' ? k : k.url, 'http://x').href
const cache = {
  put: vi.fn(async (k: string, r: Response) => void store.set(url(k), r)),
  delete: vi.fn(async (k: string | Request) => store.delete(url(k))),
  keys: vi.fn(async () => [...store.keys()].map((k) => new Request(k))),
}

beforeEach(() => {
  store.clear()
  vi.stubGlobal('caches', { open: async () => cache })
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ spineItems: [] })))
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const controlledWorker = () =>
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve({}), controller: {} } })

test('openEpub drops books parked by earlier sessions', async () => {
  controlledWorker()
  store.set('http://x/bookflix/open/old', new Response('old'))
  await openEpub('id:a', new Blob(['x']), 'a.epub', 'ltr')
  expect(store.size).toBe(1)
  expect([...store.keys()][0]).not.toContain('old')
})

test('two opens of the same book park under different keys', async () => {
  controlledWorker()
  const first = await openEpub('id:a', new Blob(['x']), 'a.epub', 'ltr')
  const keyA = [...store.keys()][0]
  first.close()
  await openEpub('id:a', new Blob(['x']), 'a.epub', 'ltr')
  expect([...store.keys()][0]).not.toBe(keyA)
})

test('openEpub rejects when the service worker never takes control', async () => {
  vi.useFakeTimers()
  const postMessage = vi.fn()
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve({ active: { postMessage } }), controller: null, addEventListener: vi.fn() },
  })
  const opening = openEpub('id:a', new Blob(['x']), 'a.epub', 'ltr')
  const assertion = expect(opening).rejects.toThrow()
  await vi.advanceTimersByTimeAsync(20_000)
  await assertion
  expect(postMessage).toHaveBeenCalledWith('claim')
})
