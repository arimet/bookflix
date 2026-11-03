import { isFileRecord, type Archive } from '@prose-reader/archive-reader'
import type { Book } from '../library/library'
import { createArchive } from '../reader/openBook'

const collator = new Intl.Collator('fr', { numeric: true })
const IMAGE = /\.(jpe?g|png|webp|gif|avif)$/i
const COVER_WIDTH = 400

export function pickCoverEntry(names: string[]): string | null {
  const images = names.filter((n) => IMAGE.test(n) && !n.startsWith('__MACOSX/')).sort(collator.compare)
  return images[0] ?? null
}

export function pickEpubCover(opf: string): string | null {
  const doc = new DOMParser().parseFromString(opf, 'application/xml')
  const items = [...doc.getElementsByTagName('item')]
  const byProperty = items.find((i) => i.getAttribute('properties')?.split(' ').includes('cover-image'))
  const metaId = [...doc.getElementsByTagName('meta')].find((m) => m.getAttribute('name') === 'cover')?.getAttribute('content')
  const byMeta = items.find((i) => i.getAttribute('id') === metaId)
  const firstImage = items.find((i) => i.getAttribute('media-type')?.startsWith('image/'))
  return (byProperty ?? byMeta ?? firstImage)?.getAttribute('href') ?? null
}

async function recordBlob(archive: Archive, uri: string | null) {
  const record = uri ? archive.recordsByUri.get(uri) : undefined
  return record && isFileRecord(record) ? record.blob() : null
}

async function epubCover(archive: Archive): Promise<Blob | null> {
  const container = await (await recordBlob(archive, 'META-INF/container.xml'))?.text()
  const opfPath = container?.match(/full-path="([^"]+)"/)?.[1]
  const opf = opfPath ? await (await recordBlob(archive, opfPath))?.text() : undefined
  const href = opf ? pickEpubCover(opf) : null
  if (!href || !opfPath) return null
  const resolved = new URL(href, `https://x/${opfPath}`).pathname.slice(1)
  return recordBlob(archive, decodeURIComponent(resolved))
}

async function pdfCover(blob: Blob): Promise<Blob | null> {
  const { openPdf } = await import('../reader/pdf')
  const task = openPdf(blob)
  const doc = await task.promise
  const page = await doc.getPage(1)
  const viewport = page.getViewport({ scale: COVER_WIDTH / page.getViewport({ scale: 1 }).width })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  await page.render({ canvas, viewport }).promise
  await task.destroy()
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8))
}

async function shrink(image: Blob): Promise<Blob | null> {
  const bitmap = await createImageBitmap(image)
  const scale = Math.min(1, COVER_WIDTH / bitmap.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8))
}

export async function coverFromArchive(archive: Archive, book: Book): Promise<Blob | null> {
  try {
    const image =
      book.format === 'epub'
        ? await epubCover(archive)
        : await recordBlob(archive, pickCoverEntry(archive.records.filter(isFileRecord).map((r) => r.uri)))
    return image ? shrink(image) : null
  } finally {
    await archive.close()
  }
}

export async function extractCover(blob: Blob, book: Book): Promise<Blob | null> {
  if (book.format === 'pdf') return pdfCover(blob)
  return coverFromArchive(await createArchive(blob, book.file.name, book.format), book)
}
