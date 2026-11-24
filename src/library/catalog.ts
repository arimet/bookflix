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

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

// A sub-folder carries its parent's name ("Batman/One-Shot" → "Batman · One-Shot"), unless it already holds it.
export function buildSeries(tree: Folder): Series[] {
  const all: Series[] = tree.books.map((b) => series(`book:${b.id}`, b.title, [b]))
  const walk = (folder: Folder, parent?: Folder) => {
    const title = parent && !fold(folder.name).includes(fold(parent.name)) ? `${parent.name} · ${folder.name}` : folder.name
    if (folder.books.length) all.push(series(folder.path, title, folder.books))
    folder.folders.forEach((child) => walk(child, folder))
  }
  tree.folders.forEach((folder) => walk(folder))
  return all
}

export const newestBook = (s: Series) => s.books.find((b) => b.file.serverModified === s.addedAt) ?? s.books[0]

export const recentlyAdded = (all: Series[], n = 20) =>
  [...all].sort((a, b) => b.addedAt.localeCompare(a.addedAt)).slice(0, n)

export const ofKind = (all: Series[], kind: Kind) =>
  all.filter((s) => s.kind === kind).sort((a, b) => collator.compare(a.title, b.title))

// A folder matching the query, an ancestor one included (an author), gives its series; otherwise a matching
// book title gives that book alone.
export function searchLibrary(all: Series[], query: string): { series: Series[]; books: Book[] } {
  const q = fold(query.trim())
  if (!q) return { series: [], books: [] }
  const byName = (a: { title: string }, b: { title: string }) => collator.compare(a.title, b.title)
  const found = all.filter((s) => fold(s.key.startsWith('book:') ? s.title : s.key).includes(q))
  const books = all.filter((s) => !found.includes(s)).flatMap((s) => s.books).filter((b) => fold(b.title).includes(q))
  return { series: found.sort(byName), books: books.sort(byName) }
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

// A folder of the library, not a book lying alone at its root.
export const isFolder = (s: Series) => !s.key.startsWith('book:')

// Series filed next to this one, under the same parent folder (an author: "Agatha Christie/Miss Marple" for
// "Agatha Christie/Hercule Poirot"); for a top-level folder, the series in its own sub-folders.
export function relatedSeries(all: Series[], s: Series): Series[] {
  if (!isFolder(s)) return []
  const parent = s.key.includes('/') ? s.key.slice(0, s.key.lastIndexOf('/')) : s.key
  return all
    .filter((other) => other !== s && (other.key === parent || other.key.startsWith(`${parent}/`)))
    .sort((a, b) => collator.compare(a.key, b.key))
}

export type HeroPick = { series: Series; book: Book; after?: { book: Book; series: Series; same: boolean } }

// The book in progress; else, after the last book read, the next unread volume of its series (same: true) or
// a series of the same author not finished yet; else a series picked at random (random: a number in [0, 1)),
// at its first unread volume.
export function heroPick(all: Series[], progress: ProgressMap, random: number): HeroPick | null {
  const book = readingNow(all, progress)[0]
  if (book) return { series: seriesOfBook(all, book.id)!, book }
  const last = readingHistory(all, progress)[0]
  if (last) {
    const after = { book: last.book, series: last.series }
    const next = last.series.books.slice(last.series.books.indexOf(last.book) + 1).find((b) => !isRead(b, progress))
    if (next) return { series: last.series, book: next, after: { ...after, same: true } }
    const related = relatedSeries(all, last.series).find((s) => !isRead(resumeBook(s, progress), progress))
    if (related) return { series: related, book: resumeBook(related, progress), after: { ...after, same: false } }
  }
  const picked = all[Math.floor(random * all.length)]
  return picked ? { series: picked, book: resumeBook(picked, progress) } : null
}

// The volume after this one in its series, if any.
export function nextInSeries(all: Series[], bookId: string): Book | undefined {
  const books = seriesOfBook(all, bookId)?.books ?? []
  return books[books.findIndex((b) => b.id === bookId) + 1]
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
