import type { Archive } from '@prose-reader/archive-reader'
import { createArchiveFromJszip } from '@prose-reader/archive-reader/archives/createArchiveFromJszip'
import { streamerHooks } from '@prose-reader/cbz'
import type { Manifest } from '@prose-reader/shared'
import { Streamer, type StreamerManifestHookFactory } from '@prose-reader/streamer'
import JSZip from 'jszip'
import { from, type Observable } from 'rxjs'
import type { Format } from '../library/library'
import type { Direction } from '../sync/books'

export type OpenedBook = {
  manifest: Manifest
  getResource: (item: { href: string }) => Observable<Response>
  archive: Archive
  close: () => void
}

export async function createArchive(blob: Blob, name: string, format: Format): Promise<Archive> {
  if (format === 'pdf') {
    const { createArchiveFromPdf } = await import('./pdf')
    return createArchiveFromPdf(blob, name)
  }
  if (format === 'cbr') {
    const { createArchiveFromRar } = await import('./rar')
    return createArchiveFromRar(blob, name)
  }
  const encodingFormat = format === 'cbz' ? 'application/vnd.comicbook+zip' : 'application/epub+zip'
  return createArchiveFromJszip(await JSZip.loadAsync(blob), { name, encodingFormat })
}

// Runs before the cbz hooks so the spread split follows the direction the reader chose.
const forceDirection =
  (direction: Direction): StreamerManifestHookFactory =>
  () =>
  (manifest) => ({ ...manifest, readingDirection: direction })

export const openBook = async (blob: Blob, name: string, format: Format, direction: Direction) =>
  openArchive(await createArchive(blob, name, format), direction)

export async function openArchive(archive: Archive, direction: Direction): Promise<OpenedBook> {
  const streamer = new Streamer({
    getArchive: async () => archive,
    // We own the archive for the whole reading session; the default 5 min idle cleanup would close it under us.
    cleanArchiveAfter: Infinity,
    hooks: { manifest: [forceDirection(direction), ...streamerHooks.manifest], resource: streamerHooks.resource },
  })
  const res = await streamer.fetchManifest()
  if (!res.ok) {
    archive.close()
    throw new Error(`Cannot read ${archive.filename ?? 'book'}`)
  }
  return {
    manifest: await res.json(),
    getResource: (item) => from(streamer.fetchResource({ resourcePath: item.href })),
    archive,
    close: () => archive.close(),
  }
}
