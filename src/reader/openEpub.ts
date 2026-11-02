import type { Manifest } from '@prose-reader/shared'
import type { Direction } from '../sync/books'
import { OPEN_CACHE, openCacheUrl, openKey, STREAMER_PATH } from './streamerKey'

const CONTROL_TIMEOUT = 10_000

const timeout = (ms: number) =>
  new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Service worker unavailable')), ms))

// On a first visit or after a hard reload the worker is active but not controlling the page: ask it to claim.
async function serviceWorkerControl() {
  const sw = navigator.serviceWorker
  const registration = await Promise.race([sw.ready, timeout(CONTROL_TIMEOUT)])
  if (sw.controller) return
  const controlled = new Promise((resolve) => sw.addEventListener('controllerchange', resolve, { once: true }))
  registration.active?.postMessage('claim')
  await Promise.race([controlled, timeout(CONTROL_TIMEOUT)])
}

export async function openEpub(bookId: string, blob: Blob, name: string, direction: Direction): Promise<{ manifest: Manifest; close: () => void }> {
  const key = openKey(bookId, direction)
  const cache = await caches.open(OPEN_CACHE)
  // One book is read at a time; copies left by a killed app (common on iOS) are dropped here.
  for (const request of await cache.keys()) await cache.delete(request)
  await cache.put(openCacheUrl(key), new Response(blob, { headers: { 'X-Name': name } }))
  await serviceWorkerControl()
  const res = await fetch(`${STREAMER_PATH}${key}/manifest`)
  if (!res.ok) {
    await cache.delete(openCacheUrl(key))
    throw new Error(`Cannot read ${name}`)
  }
  return { manifest: await res.json(), close: () => void cache.delete(openCacheUrl(key)) }
}
