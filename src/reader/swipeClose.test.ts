import { describe, expect, it } from 'vitest'
import { isAtLastPage, isClosingSwipe, upwardPull } from './createAppReader'

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
