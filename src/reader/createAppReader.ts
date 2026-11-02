import { cbzEnhancer } from '@prose-reader/cbz'
import { createReader } from '@prose-reader/core'
import { galleryEnhancer } from '@prose-reader/enhancer-gallery'
import { gesturesEnhancer } from '@prose-reader/enhancer-gestures'
import { pdfEnhancer } from '@prose-reader/enhancer-pdf'
import { refitEnhancer } from '@prose-reader/enhancer-refit'

// Same order as the prose-reader demo, minus annotations, search and audio (out of scope).
// pdfEnhancer replaces getResource for every item, so it is only applied to PDF books.
export const createAppReader = refitEnhancer(galleryEnhancer(gesturesEnhancer(cbzEnhancer(createReader))))
export const createPdfReader = refitEnhancer(galleryEnhancer(pdfEnhancer(gesturesEnhancer(cbzEnhancer(createReader)))))

export type AppReader = ReturnType<typeof createAppReader>
