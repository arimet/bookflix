import pdfjsViewerInlineCss from 'pdfjs-dist/web/pdf_viewer.css?inline'
import { of } from 'rxjs'
import type { Book } from '../library/library'
import type { Direction } from '../sync/books'
import { createAppReader, createPdfReader, type AppReader } from './createAppReader'
import { getBookBlob, localBookBlob } from '../offline/offline'
import { openArchive, openBook } from './openBook'
import { createLocalArchive, createRemoteArchive } from './remoteZip'
import { openEpub } from './openEpub'

type Target = { type: 'cfi'; value: string } | undefined

// prose-reader keeps 3 spine items loaded on each side by default. A comic page is a big image (about 12 MB
// once decoded for a 2100 px manga page), an EPUB chapter a whole web page in its own frame: 7 of them make
// Safari on iPhone kill the tab. One on each side.
const PRELOAD = { numberOfAdjacentSpineItemToPreLoad: 1 }

// EPUB documents load their CSS, fonts and images by URL, so they go through the service worker.
// Comics and PDFs are served from the page: libarchive and pdf.js cannot run in a service worker.
export async function openReader(book: Book, direction: Direction, target: Target): Promise<{ reader: AppReader; close: () => void }> {
  const local = await localBookBlob(book)
  // A CBZ is read page by page, from Dropbox or from the copy on the device, never unzipped whole.
  if (book.format === 'cbz') {
    try {
      const opened = await openArchive(await (local ? createLocalArchive(book, local) : createRemoteArchive(book)), direction)
      return { reader: createAppReader({ ...PRELOAD, manifest: opened.manifest, getResource: opened.getResource, target }), close: opened.close }
    } catch (e) {
      // Unzipping the same bytes whole would only fail later, after holding hundreds of MB in memory.
      if (local) throw e
      console.warn('Range reading failed, downloading the whole book', e) // falls through to the download below
    }
  }
  const blob = local ?? (await getBookBlob(book))
  if (book.format === 'epub') {
    const { manifest, close } = await openEpub(book.id, blob, book.file.name, direction)
    return { reader: createAppReader({ ...PRELOAD, manifest, target }), close }
  }
  const opened = await openBook(blob, book.file.name, book.format, direction)
  const reader: AppReader =
    book.format === 'pdf'
      ? createPdfReader({ ...PRELOAD, manifest: opened.manifest, target, pdf: { pdfjsViewerInlineCss, getArchiveForItem: () => of(opened.archive) } })
      : createAppReader({ ...PRELOAD, manifest: opened.manifest, getResource: opened.getResource, target })
  return { reader, close: opened.close }
}
