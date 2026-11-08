import pdfjsViewerInlineCss from 'pdfjs-dist/web/pdf_viewer.css?inline'
import type { Manifest } from '@prose-reader/shared'
import { of } from 'rxjs'
import type { Book } from '../library/library'
import type { Direction, Flow } from '../sync/books'
import { createAppReader, createPdfReader, type AppReader } from './createAppReader'
import { getBookBlob, localBookBlob } from '../offline/offline'
import { openArchive, openBook, type OpenedBook } from './openBook'
import { createLocalArchive, createRemoteArchive } from './remoteZip'
import { openEpub } from './openEpub'

type Target = { type: 'cfi'; value: string } | undefined

// prose-reader keeps 3 spine items loaded on each side by default. A comic page is a big image (about 12 MB
// once decoded for a 2100 px manga page), an EPUB chapter a whole web page in its own frame: 7 of them make
// Safari on iPhone kill the tab. One on each side.
const PRELOAD = { numberOfAdjacentSpineItemToPreLoad: 1 }

// The reader's options for a book: scroll reads it as one strip from top to bottom. A book that asks for
// scrolling itself (an EPUB in scrolled-continuous flow) scrolls either way.
// Scrolling, the pages show at once: prose-reader fades each one in over 0.8 s, which reads as a page loading.
// A pinch is left to the browser, which zooms smoothly (see scrollingFixes): prose-reader neither zooms
// (zoomMaxScale 1) nor changes the font size.
export const readerOptions = (flow: Flow) =>
  flow === 'scroll'
    ? ({ ...PRELOAD, pageTurnMode: 'scrollable', layoutLayerTransition: false, gestures: { zoomMaxScale: 1, fontScalePinchEnabled: false } } as const)
    : ({ ...PRELOAD, pageTurnMode: 'controlled' } as const)

// Scrolling down an EPUB: marked scrolled-continuous, prose-reader sizes each chapter to its content instead of
// one screen (see scrollingFixes). Comics read by scrolling are shown by ComicStrip instead.
export const scrolledManifest = (manifest: Manifest): Manifest => ({
  ...manifest,
  renditionFlow: 'scrolled-continuous',
  spineItems: manifest.spineItems.map((item) => ({ ...item, renditionFlow: 'scrolled-continuous' })),
})

// scrollOnly: the book asks for scrolling itself, it cannot be read page by page.
type Opened = { reader: AppReader; close: () => void; scrollOnly: boolean }

// A comic's pages, an image each (CBZ, CBR). A CBZ is read page by page, from Dropbox or from the copy on the
// device, never unzipped whole; a CBR is downloaded.
export async function openComic(book: Book, direction: Direction): Promise<OpenedBook> {
  const local = await localBookBlob(book)
  if (book.format === 'cbz') {
    try {
      return await openArchive(await (local ? createLocalArchive(book, local) : createRemoteArchive(book)), direction)
    } catch (e) {
      // Unzipping the same bytes whole would only fail later, after holding hundreds of MB in memory.
      if (local) throw e
      console.warn('Range reading failed, downloading the whole book', e) // falls through to the download below
    }
  }
  return openBook(local ?? (await getBookBlob(book)), book.file.name, book.format, direction)
}

export const isComic = (book: Book) => book.format === 'cbz' || book.format === 'cbr'

// EPUB documents load their CSS, fonts and images by URL, so they go through the service worker.
// Comics and PDFs are served from the page: libarchive and pdf.js cannot run in a service worker.
export async function openReader(book: Book, direction: Direction, target: Target, flow: Flow = 'pages'): Promise<Opened> {
  const options = readerOptions(flow)
  const shape = (manifest: Manifest) => (flow === 'scroll' ? scrolledManifest(manifest) : manifest)
  if (isComic(book)) {
    const opened = await openComic(book, direction)
    return { reader: createAppReader({ ...options, manifest: shape(opened.manifest), getResource: opened.getResource, target }), close: opened.close, scrollOnly: false }
  }
  const blob = (await localBookBlob(book)) ?? (await getBookBlob(book))
  if (book.format === 'epub') {
    const { manifest, close } = await openEpub(book.id, blob, book.file.name, direction)
    const scrollOnly = manifest.renditionFlow === 'scrolled-continuous'
    return { reader: createAppReader({ ...options, manifest: shape(manifest), target }), close, scrollOnly }
  }
  const opened = await openBook(blob, book.file.name, book.format, direction)
  return {
    reader: createPdfReader({ ...options, manifest: opened.manifest, target, pdf: { pdfjsViewerInlineCss, getArchiveForItem: () => of(opened.archive) } }),
    close: opened.close,
    scrollOnly: false,
  }
}
