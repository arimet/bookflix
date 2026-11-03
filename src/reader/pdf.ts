import { blobFileAccessors, createArchive } from '@prose-reader/archive-reader'
import { createArchiveFromPdf as libraryArchive } from '@prose-reader/enhancer-pdf'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

// pdf.js asks for the parts of the file a page needs, read from the blob (a file on disk for a downloaded book):
// a PDF of several hundred MB never sits whole in memory, as it would with getDocument({ data }).
export function openPdf(blob: Blob) {
  const transport = new pdfjsLib.PDFDataRangeTransport(blob.size, null)
  transport.requestDataRange = (begin: number, end: number) => {
    blob.slice(begin, end).arrayBuffer().then((bytes) => transport.onDataRange(begin, new Uint8Array(bytes)))
  }
  return pdfjsLib.getDocument({ range: transport, disableAutoFetch: true, disableStream: true })
}

const TINY_PDF = '%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
  '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 1 1]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF'

// The pdf enhancer only takes archives carrying a private symbol of its own: borrowed once from a tiny PDF.
// ponytail: leans on enhancer-pdf internals (_symbol, proxyDocument, page records); recheck on upgrade.
let template: ReturnType<typeof libraryArchive> | undefined

// Same archive as enhancer-pdf's createArchiveFromPdf, the document read by ranges.
export async function createArchiveFromPdf(blob: Blob, name: string) {
  template ??= libraryArchive(new Blob([TINY_PDF]), 'template.pdf')
  const [pdf, borrowed] = await Promise.all([openPdf(blob).promise, template])
  const pages = Array.from({ length: pdf.numPages }, (_, i) => `${i}.pdf`)
  const opf = `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="bookid">
    <metadata><meta property="rendition:layout">pre-paginated</meta></metadata>
    <manifest>${pages.map((uri, i) => `<item id="page-${i}" href="${uri}" />`).join('')}</manifest>
    <spine>${pages.map((_, i) => `<itemref idref="page-${i}" />`).join('')}</spine>
  </package>`
  const archive = createArchive({
    filename: name,
    encodingFormat: 'application/pdf',
    records: [
      { dir: false, basename: 'content.opf', uri: 'content.opf', size: 0, ...blobFileAccessors(async () => new Blob([opf])) },
      ...pages.map((uri) => ({ dir: false as const, basename: uri, uri, size: 0, ...blobFileAccessors(async () => { throw new Error('Unable to get blob from pdf') }) })),
    ],
    close: () => pdf.cleanup(),
  })
  return { ...archive, proxyDocument: pdf, _symbol: (borrowed as typeof borrowed & { _symbol: symbol })._symbol }
}
