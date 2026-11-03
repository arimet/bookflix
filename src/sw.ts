/// <reference lib="webworker" />
import type { Archive } from '@prose-reader/archive-reader'
import { createArchiveFromJszip } from '@prose-reader/archive-reader/archives/createArchiveFromJszip'
import { streamerHooks } from '@prose-reader/cbz'
import { ServiceWorkerStreamer, type StreamerManifestHookFactory } from '@prose-reader/streamer'
import JSZip from 'jszip'
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import type { Direction } from './sync/books'
import { OPEN_CACHE, openCacheUrl, parseOpenKey, STREAMER_PATH } from './reader/streamerKey'

declare const self: ServiceWorkerGlobalScope

type BookArchive = Archive & { direction?: Direction }

const forceDirection: StreamerManifestHookFactory =
  ({ archive }) =>
  (manifest) => ({ ...manifest, readingDirection: (archive as BookArchive).direction ?? manifest.readingDirection })

// Debug messages for the reader's "?debug" log: iOS stops idle service workers, and each restart reopens the book.
const startedAt = Date.now()
const debug = (msg: string) =>
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => clients.forEach((c) => c.postMessage({ debug: msg })))

// EPUBs are served from here: their documents load their own CSS, fonts and images by URL.
const streamer = new ServiceWorkerStreamer({
  cleanArchiveAfter: 5 * 60 * 1000,
  hooks: { manifest: [forceDirection, ...streamerHooks.manifest], resource: streamerHooks.resource },
  getUriInfo: (event) => {
    const url = new URL(event.request.url)
    return url.pathname.startsWith(STREAMER_PATH) ? { baseUrl: url.origin + STREAMER_PATH.slice(0, -1) } : undefined
  },
  getArchive: async (key) => {
    const opening = Date.now()
    const parked = await (await caches.open(OPEN_CACHE)).match(openCacheUrl(key))
    if (!parked) throw new Error(`No open book for ${key}`)
    const zip = await JSZip.loadAsync(await parked.blob())
    const archive: BookArchive = await createArchiveFromJszip(zip, {
      name: parked.headers.get('X-Name') ?? 'book.epub',
      encodingFormat: 'application/epub+zip',
    })
    archive.direction = parseOpenKey(key).direction
    debug(`book opened in ${Date.now() - opening} ms, worker up for ${Math.round((opening - startedAt) / 1000)} s`)
    return archive
  },
})

self.addEventListener('fetch', (event) => streamer.fetchEventListener(event))
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('message', (event) => event.data === 'claim' && event.waitUntil(self.clients.claim()))

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
