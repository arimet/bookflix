import pdfjsViewerInlineCss from 'pdfjs-dist/web/pdf_viewer.css?inline'
import { of } from 'rxjs'
import type { Book } from '../library/library'
import type { Direction } from '../sync/books'
import { createAppReader, createPdfReader, type AppReader } from './createAppReader'
import { getBookBlob, localBookBlob } from '../offline/offline'
import { openArchive, openBook } from './openBook'
import { createRemoteArchive } from './remoteZip'
import { openEpub } from './openEpub'

type Target = { type: 'cfi'; value: string } | undefined

// A comic page is a big image (a 2100 px manga page takes about 12 MB once decoded). prose-reader keeps
// 3 pages loaded on each side by default: 7 such pages make Safari on iPhone kill the tab. One on each side.
const COMIC = { numberOfAdjacentSpineItemToPreLoad: 1 }

// EPUB documents load their CSS, fonts and images by URL, so they go through the service worker.
// Comics and PDFs are served from the page: libarchive and pdf.js cannot run in a service worker.
export async function openReader(book: Book, direction: Direction, target: Target): Promise<{ reader: AppReader; close: () => void }> {
  const local = await localBookBlob(book)
  // A CBZ not on the device is read from Dropbox page by page instead of waiting for the whole file.
  if (book.format === 'cbz' && !local) {
    try {
      const opened = await openArchive(await createRemoteArchive(book), direction)
      return { reader: createAppReader({ ...COMIC, manifest: opened.manifest, getResource: opened.getResource, target }), close: opened.close }
    } catch (e) {
      console.warn('Range reading failed, downloading the whole book', e) // falls through to the download below
    }
  }
  const blob = local ?? (await getBookBlob(book))
  if (book.format === 'epub') {
    const { manifest, close } = await openEpub(book.id, blob, book.file.name, direction)
    return { reader: createAppReader({ manifest, target }), close }
  }
  const opened = await openBook(blob, book.file.name, book.format, direction)
  const reader: AppReader =
    book.format === 'pdf'
      ? createPdfReader({ ...COMIC, manifest: opened.manifest, target, pdf: { pdfjsViewerInlineCss, getArchiveForItem: () => of(opened.archive) } })
      : createAppReader({ ...COMIC, manifest: opened.manifest, getResource: opened.getResource, target })
  return { reader, close: opened.close }
}
