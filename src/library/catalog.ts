import type { ProgressMap } from '../sync/progress'
import type { Book, Folder } from './library'

export type Kind = 'comics' | 'books'
// key: the folder path, or `book:<id>` for a book lying at the root of the library
export type Series = { key: string; title: string; books: Book[]; kind: Kind; addedAt: string }

const collator = new Intl.Collator('fr', { numeric: true })
const READ = 0.99

function series(key: string, title: string, books: Book[]): Series {
  const comics = books.filter((b) => b.format === 'cbz' || b.format === 'cbr').length
  return {
    key,
    title,
    books,
    kind: comics * 2 > books.length ? 'comics' : 'books',
    addedAt: books.map((b) => b.file.serverModified).sort().at(-1) ?? '',
  }
}

export function buildSeries(tree: Folder): Series[] {
  const all: Series[] = tree.books.map((b) => series(`book:${b.id}`, b.title, [b]))
  const walk = (folder: Folder) => {
    if (folder.books.length) all.push(series(folder.path, folder.name, folder.books))
    folder.folders.forEach(walk)
  }
  tree.folders.forEach(walk)
  return all
}

export const recentlyAdded = (all: Series[], n = 20) =>
  [...all].sort((a, b) => b.addedAt.localeCompare(a.addedAt)).slice(0, n)

export const ofKind = (all: Series[], kind: Kind) =>
  all.filter((s) => s.kind === kind).sort((a, b) => collator.compare(a.title, b.title))

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export function searchSeries(all: Series[], query: string): Series[] {
  const q = fold(query.trim())
  if (!q) return []
  return all
    .filter((s) => fold(s.title).includes(q) || s.books.some((b) => fold(b.title).includes(q)))
    .sort((a, b) => collator.compare(a.title, b.title))
}

const inProgress = (book: Book, progress: ProgressMap) => {
  const p = progress[book.id]
  return p && p.percent > 0 && p.percent < READ ? p : undefined
}

export function resumeBook(s: Series, progress: ProgressMap): Book {
  const reading = s.books
    .filter((b) => inProgress(b, progress))
    .sort((a, b) => progress[b.id].updatedAt - progress[a.id].updatedAt)[0]
  return reading ?? s.books.find((b) => (progress[b.id]?.percent ?? 0) < READ) ?? s.books[0]
}

export const isRead = (book: Book, progress: ProgressMap) => (progress[book.id]?.percent ?? 0) >= READ

export const findSeries = (all: Series[], key: string) => all.find((s) => s.key === key)

export const seriesOfBook = (all: Series[], bookId: string) => all.find((s) => s.books.some((b) => b.id === bookId))

export function readingNow(all: Series[], progress: ProgressMap): Book[] {
  return all
    .flatMap((s) => s.books)
    .filter((b) => inProgress(b, progress))
    .sort((a, b) => progress[b.id].updatedAt - progress[a.id].updatedAt)
}

export function heroPick(all: Series[], progress: ProgressMap): { series: Series; book: Book } | null {
  const book = readingNow(all, progress)[0]
  if (book) return { series: seriesOfBook(all, book.id)!, book }
  const newest = recentlyAdded(all, 1)[0]
  return newest ? { series: newest, book: newest.books[0] } : null
}

export type HistoryItem = { book: Book; series: Series; entry: ProgressMap[string] }

// Books opened by the profile, newest first. Reset books and books no longer in the library are left out.
export function readingHistory(all: Series[], progress: ProgressMap): HistoryItem[] {
  return Object.entries(progress)
    .filter(([, entry]) => entry.cfi)
    .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
    .flatMap(([bookId, entry]) => {
      const series = seriesOfBook(all, bookId)
      const book = series?.books.find((b) => b.id === bookId)
      return series && book ? [{ book, series, entry }] : []
    })
}
