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

// The spine item (chapter, or comic page) on screen.
export function currentSpineItem(reader: AppReader) {
  const at = reader.navigation.getNavigation().spineItem
  return reader.spineItemsManager.items.find((item) => item.index === at || item.item.id === at)
}

// Marks the spine item on screen with data-on-screen, so that only its loading screen shows a turning ring.
export function markSpineItemOnScreen(reader: AppReader) {
  let marked: HTMLElement | undefined
  return reader.navigation.navigation$.subscribe(() => {
    const element = currentSpineItem(reader)?.containerElement
    if (element === marked) return
    marked?.removeAttribute('data-on-screen')
    element?.setAttribute('data-on-screen', '')
    marked = element
  })
}
