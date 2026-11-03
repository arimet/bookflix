import { describe, expect, it } from 'vitest'
import { pageLabel } from './pageLabel'

const edge = (absolutePageIndex?: number, pageIndexInSpineItem?: number, numberOfPagesInSpineItem = 1) => ({
  absolutePageIndex,
  pageIndexInSpineItem,
  numberOfPagesInSpineItem,
})

describe('pageLabel', () => {
  it('counts the pages of the whole book', () => {
    expect(pageLabel({ begin: edge(11), end: edge(11), numberOfTotalPages: 200 }, false)).toBe('12 / 200')
  })

  it('shows both pages of a spread, in reading order or not', () => {
    expect(pageLabel({ begin: edge(13), end: edge(12), numberOfTotalPages: 200 }, false)).toBe('13-14 / 200')
  })

  it('counts the pages of the chapter in an EPUB', () => {
    expect(pageLabel({ begin: edge(40, 2, 12), end: edge(40, 2, 12), numberOfTotalPages: 300 }, true)).toBe('Chapitre : 3 / 12')
  })

  it('shows nothing before the book is laid out', () => {
    expect(pageLabel({ begin: edge(), end: edge(), numberOfTotalPages: 0 }, false)).toBe(undefined)
  })
})
