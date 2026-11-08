import { Subject } from 'rxjs'
import { describe, expect, it, vi } from 'vitest'
import { isAtLastPage, isClosingSwipe, recentlyVisited, turnOnSwipeUpToClose, upwardPull, type AppReader } from './createAppReader'

describe('upwardPull', () => {
  it('follows a swipe that goes mostly up', () => {
    expect(upwardPull({ deltaX: 20, deltaY: -100 })).toBe(-100)
  })

  it('ignores a swipe down or mostly sideways', () => {
    expect(upwardPull({ deltaX: 0, deltaY: 100 })).toBe(0)
    expect(upwardPull({ deltaX: -150, deltaY: -100 })).toBe(0)
  })
})

describe('isClosingSwipe', () => {
  it('closes on a long swipe up only', () => {
    expect(isClosingSwipe({ deltaX: 10, deltaY: -250 }, 800)).toBe(true)
    expect(isClosingSwipe({ deltaX: 10, deltaY: -100 }, 800)).toBe(false)
    expect(isClosingSwipe({ deltaX: 300, deltaY: -250 }, 800)).toBe(false)
  })
})

describe('isAtLastPage', () => {
  const edge = (spineItemIndex: number, pageIndexInSpineItem: number, numberOfPagesInSpineItem: number) =>
    ({ spineItemIndex, pageIndexInSpineItem, numberOfPagesInSpineItem })

  it('is the last page of the last item', () => {
    expect(isAtLastPage(edge(9, 0, 1), 10)).toBe(true)
    expect(isAtLastPage(edge(2, 11, 12), 3)).toBe(true)
  })

  it('is not an earlier page or item', () => {
    expect(isAtLastPage(edge(8, 0, 1), 10)).toBe(false)
    expect(isAtLastPage(edge(2, 10, 12), 3)).toBe(false)
    expect(isAtLastPage({ spineItemIndex: undefined, pageIndexInSpineItem: undefined, numberOfPagesInSpineItem: 0 }, 0)).toBe(false)
  })
})

describe('turnOnSwipeUpToClose', () => {
  type Mode = { computedPageTurnMode: 'controlled' | 'scrollable'; computedPageTurnDirection: 'horizontal' | 'vertical' }
  // Just what the swipe reads of a reader: its pans, its mode, its zoom and its height.
  const setUp = (mode: Mode) => {
    const gestures$ = new Subject<unknown>()
    const reader = {
      gestures: { gestures$ },
      settings: { values: mode },
      zoom: { state: { isZooming: false, currentScale: 1 } },
      viewport: { value: { element: { clientHeight: 800 } } },
    } as unknown as AppReader
    const moves: number[] = []
    const onClose = vi.fn()
    turnOnSwipeUpToClose(reader, { onMove: (pull) => moves.push(pull), onClose })
    const pan = (type: string, deltaY: number) =>
      gestures$.next({ type: 'pan', gestureEvent: { type, deltaX: 0, deltaY, pointers: type === 'panEnd' ? [] : [{}] } })
    const swipeUp = () => {
      pan('panStart', 0)
      pan('panMove', -150)
      pan('panMove', -300)
      pan('panEnd', -300)
    }
    return { swipeUp, moves, onClose }
  }

  it('closes a book read page by page on a long swipe up, the page following the finger', () => {
    const { swipeUp, moves, onClose } = setUp({ computedPageTurnMode: 'controlled', computedPageTurnDirection: 'horizontal' })
    swipeUp()
    expect(moves).toEqual([0, -150, -300])
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('leaves a book read by scrolling down alone: swiping up scrolls it', () => {
    const { swipeUp, moves, onClose } = setUp({ computedPageTurnMode: 'scrollable', computedPageTurnDirection: 'vertical' })
    swipeUp()
    expect(moves).toEqual([])
    expect(onClose).not.toHaveBeenCalled()
  })

  it('leaves a book whose pages turn upwards alone: swiping up turns the page', () => {
    const { swipeUp, moves, onClose } = setUp({ computedPageTurnMode: 'controlled', computedPageTurnDirection: 'vertical' })
    swipeUp()
    expect(moves).toEqual([])
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('recentlyVisited', () => {
  it('keeps the last items visited loaded, releasing the oldest, and holds each once', () => {
    const released: string[] = []
    const hold = vi.fn((id: string) => () => released.push(id))
    const kept = recentlyVisited(2, hold)
    kept.visit('a')
    kept.visit('b')
    kept.visit('a') // seen again: the most recent now, not held twice
    kept.visit('c')
    expect(hold.mock.calls.map(([id]) => id)).toEqual(['a', 'b', 'c'])
    expect(released).toEqual(['b'])
    kept.releaseAll()
    expect(released.sort()).toEqual(['a', 'b', 'c'])
  })
})
