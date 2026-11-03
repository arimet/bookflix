type Edge = { absolutePageIndex?: number; pageIndexInSpineItem?: number; numberOfPagesInSpineItem: number }
type Pagination = { begin: Edge; end: Edge; numberOfTotalPages: number }

// "12 / 200", or "12-13 / 200" when two pages are side by side. An EPUB only knows the pages of the
// chapters it has laid out, so its count is the chapter's.
export function pageLabel({ begin, end, numberOfTotalPages }: Pagination, chapters: boolean) {
  if (chapters) {
    if (begin.pageIndexInSpineItem === undefined || !begin.numberOfPagesInSpineItem) return undefined
    return `Chapitre : ${begin.pageIndexInSpineItem + 1} / ${begin.numberOfPagesInSpineItem}`
  }
  if (begin.absolutePageIndex === undefined || !numberOfTotalPages) return undefined
  const [first, last] = [begin.absolutePageIndex, end.absolutePageIndex ?? begin.absolutePageIndex].sort((a, b) => a - b)
  return `${first === last ? first + 1 : `${first + 1}-${last + 1}`} / ${numberOfTotalPages}`
}
