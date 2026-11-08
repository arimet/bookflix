import { cbzEnhancer } from '@prose-reader/cbz'
import { createReader, type Reader } from '@prose-reader/core'
import { galleryEnhancer } from '@prose-reader/enhancer-gallery'
import { gesturesEnhancer } from '@prose-reader/enhancer-gestures'
import { pdfEnhancer } from '@prose-reader/enhancer-pdf'
import { refitEnhancer } from '@prose-reader/enhancer-refit'
import { asyncScheduler, concat, first, Subscription, concatMap, debounceTime, defer, distinctUntilChanged, EMPTY, filter, fromEvent, switchMap, throttleTime, from, ignoreElements, map, of, tap, type Observable } from 'rxjs'

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

// Both ways: zoomed in, the page is moved around by scrolling it (prose-reader's zoom when scrolling).
const PAN = '{ touch-action: pan-x pan-y !important }'
// Two fingers pinch the page: the browser must not scroll it, prose-reader ignores a pinch while it scrolls.
const holdStillWhilePinching = (target: Document | HTMLElement) =>
  fromEvent<TouchEvent>(target, 'touchmove', { passive: false }).subscribe((event) => {
    if (event.touches.length > 1 && event.cancelable) event.preventDefault()
  })
// Undoes the columns prose-reader lays a chapter out in, even when scrolling (a page beside the other, all but
// the first out of sight): the chapter runs down as one strip, which prose-reader then sizes the frame to.
// Its top and bottom margins become padding: prose-reader sizes the frame to the body without its margins, which
// cut the last line of each chapter (24 px, prose-reader's page margin).
const ONE_STRIP = `html body {
  height: auto !important; column-width: auto !important; column-count: auto !important; overflow-y: visible !important;
  margin-top: 0 !important; margin-bottom: 0 !important; padding-top: 24px !important; padding-bottom: 24px !important;
}`

// Scrolling back must not reload what was just read: the last chapters (or comic pages, much heavier: a few
// only, Safari on iPhone kills the tab past about 7 big pages) seen stay loaded.
const KEPT_CHAPTERS = 20
const KEPT_COMIC_PAGES = 4
const RELOOK_DELAY = 200
// Loading follows the scroll: what comes within NEAR screens of the screen is loaded at once, released past FAR.
const NEAR = { chapters: 2, comics: 1 }
const FAR = { chapters: 4, comics: 2 }

// How many screens away from the screen an item is: 0 when on it.
export const screensAway = (rect: { top: number; bottom: number }, height: number) =>
  rect.bottom < 0 ? -rect.bottom / height : rect.top > height ? (rect.top - height) / height : 0

// Holds the last `limit` items visited (hold returns the release), releasing the oldest beyond.
export function recentlyVisited(limit: number, hold: (id: string) => () => void) {
  const held = new Map<string, () => void>()
  return {
    visit(id: string) {
      const release = held.get(id)
      held.delete(id)
      held.set(id, release ?? hold(id)) // last in the map: the most recent
      if (held.size <= limit) return
      const [oldest, releaseOldest] = held.entries().next().value!
      held.delete(oldest)
      releaseOldest()
    },
    releaseAll() {
      held.forEach((release) => release())
      held.clear()
    },
  }
}

// Scrolling down, as prose-reader 36 does it, does not work on iPhone:
// - a finger cannot scroll: the gestures put touch-action: none on the whole reader, and the CSS of comic pages,
//   meant to let touches through in that mode, blocks them on every element (`:not(html.…-touch-enabled) body`
//   matches any body). Pans are left to the browser, around the pages and on them; pinches and taps stay with
//   the gestures, the browser kept from scrolling under a pinch.
// - an EPUB chapter shows its first page only (ONE_STRIP); openReader also marks the book scrolled-continuous,
//   for prose-reader to size each chapter to its content.
// - scrolling back reloads what was just read, prose-reader keeping one item on each side only.
// - a fast scroll runs onto chapters never loaded: prose-reader loads one item on each side of where the scroll
//   stopped, half a second after. Loading follows the scroll instead (NEAR).
// ponytail: works around prose-reader 36; recheck on upgrade.
export const scrollingFixes =
  <O, R extends Reader>(next: (options: O) => R) =>
  (options: O) => {
    const reader = next(options)
    if (reader.settings.values.computedPageTurnMode !== 'scrollable') return reader
    const container = `[data-prose-reader-container="${reader.id}"]`
    const removeOuter = reader.utils.injectScopedCSS(document, 'bookflix-scrolling', `${container}, ${container} * ${PAN}`)
    const pinches = new Subscription()
    pinches.add(reader.context.watch('rootElement')
      .pipe(filter((root): root is HTMLElement => !!root), first())
      .subscribe((root) => pinches.add(holdStillWhilePinching(root))))
    const documentOf = (itemId: string) => reader.spineItemsManager.get(itemId)?.renderer.getDocumentFrame()?.contentDocument
    reader.hookManager.register('item.onDocumentLoad', async ({ itemId }) => {
      const doc = documentOf(itemId)
      if (!doc) return
      reader.utils.injectScopedCSS(doc, 'bookflix-touch', `* ${PAN}`)
      pinches.add(holdStillWhilePinching(doc))
    })
    // Before each layout: prose-reader sets the columns again, then measures the chapter.
    reader.hookManager.register('item.onBeforeLayout', ({ item }) => {
      const doc = documentOf(item.id)
      if (doc && reader.spineItemsManager.get(item.id)?.renditionLayout === 'reflowable') reader.utils.injectScopedCSS(doc, 'bookflix-strip', ONE_STRIP)
    })
    // A chapter that loads grows and pushes the others: what then comes on screen may be a chapter never loaded,
    // prose-reader looking at what to load only when the reader scrolls. A scroll event makes it look again.
    const relook = reader.spineItemsObserver.itemStateChange$
      .pipe(filter(({ isReady }) => isReady), debounceTime(RELOOK_DELAY))
      .subscribe(() => reader.navigation.scrollNavigationController.value.element?.dispatchEvent(new Event('scroll')))
    const comics = reader.context.manifest?.renditionLayout === 'pre-paginated'
    const [near, far] = comics ? [NEAR.comics, FAR.comics] : [NEAR.chapters, FAR.chapters]
    const nearby = new Map<string, () => void>()
    const follow = reader.navigation.scrollNavigationController
      .watch('element')
      .pipe(
        switchMap((element) => (element ? fromEvent(element, 'scroll') : EMPTY)),
        throttleTime(100, asyncScheduler, { leading: true, trailing: true }),
      )
      .subscribe(() => {
        const height = reader.viewport.value.element.clientHeight
        for (const item of reader.spineItemsManager.items) {
          const id = item.item.id
          const away = screensAway(item.containerElement.getBoundingClientRect(), height)
          // Loaded at once: prose-reader's loader waits for the scroll to stop. The hold keeps it from unloading it.
          if (away <= near && !nearby.has(id)) {
            nearby.set(id, reader.keepSpineItemLoaded(id))
            item.load()
          }
          if (away > far && nearby.has(id)) {
            nearby.get(id)!()
            nearby.delete(id)
          }
        }
      })
    const kept = recentlyVisited(comics ? KEPT_COMIC_PAGES : KEPT_CHAPTERS, (id) => reader.keepSpineItemLoaded(id))
    const visits = reader.navigation.navigation$.subscribe(() => {
      const item = reader.spineItemsManager.get(reader.navigation.getNavigation().spineItem)
      if (item) kept.visit(item.item.id)
    })
    return {
      ...reader,
      destroy: () => {
        visits.unsubscribe()
        relook.unsubscribe()
        pinches.unsubscribe()
        follow.unsubscribe()
        nearby.forEach((release) => release())
        kept.releaseAll()
        removeOuter()
        reader.destroy()
      },
    }
  }

// Same order as the prose-reader demo, minus annotations, search and audio (out of scope).
// pdfEnhancer replaces getResource for every item, so it is only applied to PDF books.
export const createAppReader = scrollingFixes(refitEnhancer(galleryEnhancer(gesturesEnhancer(cbzEnhancer(flatLayout(createReader))))))
export const createPdfReader = scrollingFixes(refitEnhancer(galleryEnhancer(pdfEnhancer(gesturesEnhancer(cbzEnhancer(flatLayout(createReader)))))))

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

type PageEdge = { spineItemIndex: number | undefined; pageIndexInSpineItem: number | undefined; numberOfPagesInSpineItem: number }

// Whether the last page of the book is on screen (a spread counts by its right-hand or lower page).
export const isAtLastPage = (end: PageEdge, numberOfItems: number) =>
  numberOfItems > 0 && end.spineItemIndex === numberOfItems - 1 && end.pageIndexInSpineItem === end.numberOfPagesInSpineItem - 1

// Calls onChange(true) when the last page of the book comes on screen, onChange(false) when it leaves.
export function watchLastPage(reader: AppReader, onChange: (atEnd: boolean) => void) {
  return reader.pagination.state$
    .pipe(
      filter((state) => state.isSettled),
      map((state) => isAtLastPage(state.end, reader.spineItemsManager.items.length)),
      distinctUntilChanged(),
    )
    .subscribe(onChange)
}

// How far up, as a share of the screen height, a swipe must go to close the book.
const CLOSE_PULL = 0.2

// How far up the swipe has moved the page: 0 for a swipe that is not mostly upwards.
export const upwardPull = (pan: { deltaX: number; deltaY: number }) =>
  pan.deltaY < 0 && -pan.deltaY > Math.abs(pan.deltaX) ? pan.deltaY : 0

export const isClosingSwipe = (pan: { deltaX: number; deltaY: number }, height: number) => upwardPull(pan) < -height * CLOSE_PULL

// Like closing a photo on iPhone: a long swipe up closes the book. onMove(pull) follows the finger (pull
// is negative, 0 to put the page back), onClose ends it. Zoomed in, scrolling or with two fingers, a pan
// keeps prose-reader's meaning.
export function turnOnSwipeUpToClose(reader: AppReader, { onMove, onClose }: { onMove: (pull: number) => void; onClose: () => void }) {
  let active = false
  const followable = () =>
    !isZoomedIn(reader.zoom.state) && reader.settings.values.computedPageTurnMode !== 'scrollable'
    && reader.settings.values.computedPageTurnDirection === 'horizontal'
  return reader.gestures.gestures$
    .pipe(filter((gesture) => gesture.type === 'pan'))
    .subscribe(({ gestureEvent: event }) => {
      if (event.type === 'panStart') active = event.pointers.length === 1 && followable()
      if (!active) return
      // A second finger (a pinch) or a zoom on the way: not a swipe any more.
      if (!followable() || (event.type === 'panMove' && event.pointers.length > 1)) {
        active = false
        return onMove(0)
      }
      if (event.type !== 'panEnd') return onMove(upwardPull(event))
      active = false
      if (isClosingSwipe(event, reader.viewport.value.element.clientHeight)) onClose()
      else onMove(0)
    })
}
