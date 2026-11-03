import { cbzEnhancer } from '@prose-reader/cbz'
import { createReader } from '@prose-reader/core'
import { galleryEnhancer } from '@prose-reader/enhancer-gallery'
import { gesturesEnhancer } from '@prose-reader/enhancer-gestures'
import { pdfEnhancer } from '@prose-reader/enhancer-pdf'
import { refitEnhancer } from '@prose-reader/enhancer-refit'
import { concat, concatMap, defer, filter, from, ignoreElements, map, of, tap, type Observable } from 'rxjs'

type Offset = { horizontalOffset: number; verticalOffset: number }
type LaidOut = { endOffset: Offset }
type SpineLayout = {
  spineItemsManager: { items: readonly unknown[] }
  layOutItem: (item: unknown, offset: Offset) => Observable<LaidOut>
  layOutItems: (laidOut: LaidOut[]) => Observable<LaidOut[]>
}

// prose-reader places the pages through one operator nested per page, all run on a single call stack: a
// 299-page manga overflowed the iPhone's stack at page 196 and the error vanished, leaving every page at
// position 0 and the loader up for good. Same placement, one page after the other on a flat stack.
// ponytail: leans on prose-reader internals (spineLayout, layOutItem, layOutItems); recheck on upgrade.
export const flatLayout =
  <O, R extends { spine: unknown }>(next: (options: O) => R) =>
  (options: O) => {
    const reader = next(options)
    const layout = (reader.spine as { spineLayout: SpineLayout }).spineLayout
    layout.layOutItems = (laidOut) =>
      defer(() => {
        const placed = [...laidOut]
        const start = { horizontalOffset: 0, verticalOffset: 0 }
        return concat(
          from(layout.spineItemsManager.items.slice(placed.length)).pipe(
            concatMap((item) => layout.layOutItem(item, placed[placed.length - 1]?.endOffset ?? start)),
            tap((item) => placed.push(item)),
            ignoreElements(),
          ),
          defer(() => of(placed)),
        )
      })
    return reader
  }

// Same order as the prose-reader demo, minus annotations, search and audio (out of scope).
// pdfEnhancer replaces getResource for every item, so it is only applied to PDF books.
export const createAppReader = refitEnhancer(galleryEnhancer(gesturesEnhancer(cbzEnhancer(flatLayout(createReader)))))
export const createPdfReader = refitEnhancer(galleryEnhancer(pdfEnhancer(gesturesEnhancer(cbzEnhancer(flatLayout(createReader))))))

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

// Pinching back below 1 leaves zoom mode, but the reader can still be in it at scale 1.
export const isZoomedIn = (state: { isZooming: boolean; currentScale: number }) => state.isZooming && state.currentScale > 1

// prose-reader alone turns the page only on the outer 15 % of the book's column: a tap beside a comic page
// opened the menu instead. Zoomed in or scrolling, taps keep prose-reader's meaning.
export function turnOnSideTaps(reader: AppReader) {
  return reader.gestures.hooks.register('beforeTapGesture', ({ event$ }) =>
    event$.pipe(
      map(({ event }) => {
        const zoomed = isZoomedIn(reader.zoom.state)
        const side = 'x' in event.event ? tapSide(event.event.x, innerWidth) : null
        if (!side || zoomed || reader.settings.values.computedPageTurnMode === 'scrollable') return true
        turnTowards(reader, side)
        return false
      }),
    ),
  )
}

// How far, as a share of the screen width, a finger must keep pulling past the page's edge to turn it.
const EDGE_PULL = 0.25

// The side to turn to when a pan while zoomed kept pulling past the edge of the page, or null. x is the
// zoom's horizontal offset: 0 with the page's left edge on screen, minX with its right edge.
export function edgePullSide(pan: { startX: number; endX: number; deltaX: number }, minX: number, width: number) {
  const pull = pan.deltaX - (pan.endX - pan.startX) // what the finger moved beyond what the page did
  if (pull > width * EDGE_PULL && pan.endX >= -1) return 'left'
  if (pull < -width * EDGE_PULL && pan.endX <= minX + 1) return 'right'
  return null
}

// Zoomed in, a pan moves around the page and stops at its edges: pulling on well past an edge turns the page,
// keeping the zoom. Runs after prose-reader has moved the zoom for the pan.
export function turnOnEdgePulls(reader: AppReader) {
  let start: { x: number; scale: number } | undefined
  return reader.gestures.gestures$
    .pipe(filter((gesture) => gesture.type === 'pan'))
    .subscribe(({ gestureEvent: event }) => {
      const zoom = reader.zoom.state
      if (event.type === 'panStart') {
        start = isZoomedIn(zoom) ? { x: zoom.currentPosition.x, scale: zoom.currentScale } : undefined
        return
      }
      if (event.type !== 'panEnd' || !start) return
      const from = start
      start = undefined
      // A pinch changes the scale: that pan was a zoom, not a pull.
      if (!isZoomedIn(zoom) || zoom.currentScale !== from.scale) return
      if (reader.settings.values.computedPageTurnDirection !== 'horizontal') return
      const width = reader.viewport.value.element.clientWidth
      const side = edgePullSide({ startX: from.x, endX: zoom.currentPosition.x, deltaX: event.deltaX }, width * (1 - zoom.currentScale), width)
      if (side) turnTowards(reader, side)
    })
}
