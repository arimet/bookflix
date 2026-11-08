// Positions in a comic read as a strip, in prose-reader's terms so that each reader resumes where the other left
// off: the CFI of the start of a page, and the share of the book read.
export const pageCfi = (index: number, id: string) => `epubcfi(/6/${(index + 1) * 2}[${id}]!)`

// The page a CFI points into (prose-reader's spine step: /6/2 for the first page), 0 without one.
export function pageOfCfi(cfi: string | undefined, count: number) {
  const step = cfi?.match(/^epubcfi\(\/6\/(\d+)/)
  return step ? Math.min(Math.max(Number(step[1]) / 2 - 1, 0), Math.max(count - 1, 0)) : 0
}

// Read to the end once the bottom of the last page is on screen.
export const stripPercent = (index: number, count: number, atEnd: boolean) => (atEnd ? 1 : count ? index / count : 0)

// The page at height y, from the tops of the pages in order.
export function pageAt(tops: number[], y: number) {
  let low = 0
  let high = tops.length - 1
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (tops[middle] <= y) low = middle
    else high = middle - 1
  }
  return low
}
