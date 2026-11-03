import { cbzEnhancer } from '@prose-reader/cbz'
import { createReader } from '@prose-reader/core'
import { galleryEnhancer } from '@prose-reader/enhancer-gallery'
import { gesturesEnhancer } from '@prose-reader/enhancer-gestures'
import { pdfEnhancer } from '@prose-reader/enhancer-pdf'
import { refitEnhancer } from '@prose-reader/enhancer-refit'
import { map } from 'rxjs'

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

// Calls onReady once the page on screen is drawn: until then the reader shows half-built frames.
export function whenPageOnScreenReady(reader: AppReader, onReady: () => void) {
  if (currentSpineItem(reader)?.value.isReady) onReady()
  return reader.spineItemsObserver.itemStateChange$.subscribe(({ item, isReady }) => {
    if (isReady && item === currentSpineItem(reader)) onReady()
  })
}

// The outer thirds of the screen turn the page, the middle one is left to the menu.
export const tapSide = (x: number, width: number) => (x < width / 3 ? 'left' : x > (width * 2) / 3 ? 'right' : null)

export function turnTowards(reader: AppReader, side: 'left' | 'right') {
  if (side === 'left') reader.navigation.turnLeftOrTop()
  else reader.navigation.turnRightOrBottom()
}

// prose-reader alone turns the page only on the outer 15 % of the book's column: a tap beside a comic page
// opened the menu instead. Zoomed in or scrolling, taps keep prose-reader's meaning.
export function turnOnSideTaps(reader: AppReader) {
  return reader.gestures.hooks.register('beforeTapGesture', ({ event$ }) =>
    event$.pipe(
      map(({ event }) => {
        const zoomed = reader.zoom.state.isZooming && reader.zoom.state.currentScale > 1
        const side = 'x' in event.event ? tapSide(event.event.x, innerWidth) : null
        if (!side || zoomed || reader.settings.values.computedPageTurnMode === 'scrollable') return true
        turnTowards(reader, side)
        return false
      }),
    ),
  )
}
