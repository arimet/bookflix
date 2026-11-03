import { expect, test } from 'vitest'
import type { DbxFile } from '../dropbox/api'
import type { ProgressMap } from '../sync/progress'
import { buildSeries, heroPick, newestBook, ofKind, readingHistory, recentlyAdded, resumeBook, searchLibrary, seriesOfBook } from './catalog'
import { buildTree } from './library'

const f = (path: string, serverModified = '2026-01-01T00:00:00Z'): DbxFile => ({
  id: `id:${path}`, name: path.split('/').pop()!, path, size: 1, rev: 'r', serverModified,
})
const catalog = (...files: DbxFile[]) => buildSeries(buildTree(files, '/Ebook'))
const p = (percent: number, updatedAt: number) => ({ cfi: 'c', percent, updatedAt, device: 'Mac' })

test('every folder holding books is a series; a book at the root is a series alone', () => {
  const series = catalog(
    f('/Ebook/Dune.epub'),
    f('/Ebook/Mangas/Boruto/T1.cbz'),
    f('/Ebook/Mangas/Boruto/T2.cbz'),
    f('/Ebook/Mangas/Akira.cbz'),
  )
  expect(series.map((s) => [s.title, s.books.length]).sort()).toEqual([['Dune', 1], ['Mangas · Boruto', 2], ['Mangas', 1]])
  expect(series.find((s) => s.title === 'Dune')!.key).toBe('book:id:/Ebook/Dune.epub')
  expect(series.find((s) => s.title === 'Mangas · Boruto')!.key).toBe('Mangas/Boruto')
})

test("a sub-folder's series carries its parent's name, unless it already holds it", () => {
  const series = catalog(
    f('/Ebook/Batman/One-Shot/Killing Joke.cbz'),
    f('/Ebook/Batman/Batman - Snyder/T1.cbz'),
    f('/Ebook/Batman/Batman Metal/Phase 2/Le Batman qui rit.cbz'),
  )
  expect(series.map((s) => s.title).sort()).toEqual(['Batman - Snyder', 'Batman Metal · Phase 2', 'Batman · One-Shot'])
})

test('a series is comics when most of its books are CBZ or CBR', () => {
  const series = catalog(f('/Ebook/A/1.cbz'), f('/Ebook/A/2.cbr'), f('/Ebook/A/notes.pdf'), f('/Ebook/B/1.epub'))
  expect(ofKind(series, 'comics').map((s) => s.title)).toEqual(['A'])
  expect(ofKind(series, 'books').map((s) => s.title)).toEqual(['B'])
})

test('recently added follows the newest book of each series', () => {
  const series = catalog(
    f('/Ebook/Old/1.epub', '2025-01-01T00:00:00Z'),
    f('/Ebook/New/1.epub', '2026-03-01T00:00:00Z'),
    f('/Ebook/Mid/1.epub', '2025-06-01T00:00:00Z'),
    f('/Ebook/Old/2.epub', '2026-05-01T00:00:00Z'),
  )
  expect(recentlyAdded(series).map((s) => s.title)).toEqual(['Old', 'New', 'Mid'])
  expect(newestBook(series.find((s) => s.title === 'Old')!).title).toBe('2')
})

test('search: a folder name, an ancestor one included, gives its series; a book title gives the book', () => {
  const series = catalog(
    f('/Ebook/Les Misérables/Tome 1.epub'),
    f('/Ebook/Agatha Christie/Hercule Poirot/Le Crime de l’Orient-Express.epub'),
    f('/Ebook/Agatha Christie/Miss Marple/Meurtre au presbytère.epub'),
    f('/Ebook/Boruto/Héros.cbz'),
    f('/Ebook/Boruto/Tome 2.cbz'),
    f('/Ebook/Dune.epub'),
  )
  const titles = (q: string) => {
    const { series: s, books } = searchLibrary(series, q)
    return [...s.map((x) => x.title), ...books.map((b) => b.title)]
  }
  expect(titles('miserables')).toEqual(['Les Misérables'])
  expect(titles('agatha')).toEqual(['Agatha Christie · Hercule Poirot', 'Agatha Christie · Miss Marple'])
  expect(searchLibrary(series, 'HEROS')).toEqual({ series: [], books: [series.find((s) => s.title === 'Boruto')!.books[0]] })
  expect(titles('orient')).toEqual(['Le Crime de l’Orient-Express'])
  expect(titles('dune')).toEqual(['Dune'])
  expect(searchLibrary(series, '  ')).toEqual({ series: [], books: [] })
})

test('resumeBook: the volume in progress, else the first unread, else the first', () => {
  const [s] = catalog(f('/Ebook/S/T1.cbz'), f('/Ebook/S/T2.cbz'), f('/Ebook/S/T3.cbz'))
  const [t1, t2, t3] = s.books
  expect(resumeBook(s, {} as ProgressMap)).toBe(t1)
  expect(resumeBook(s, { [t1.id]: p(1, 1) })).toBe(t2)
  expect(resumeBook(s, { [t1.id]: p(1, 1), [t3.id]: p(0.4, 5), [t2.id]: p(0.2, 2) })).toBe(t3)
  expect(resumeBook(s, { [t1.id]: p(1, 1), [t2.id]: p(1, 1), [t3.id]: p(1, 1) })).toBe(t1)
})

test('heroPick: latest book in progress, else the newest series', () => {
  const series = catalog(f('/Ebook/A/1.epub', '2025-01-01T00:00:00Z'), f('/Ebook/B/1.epub', '2026-01-01T00:00:00Z'))
  const a1 = series.find((s) => s.title === 'A')!.books[0]
  expect(heroPick(series, { [a1.id]: p(0.3, 9) })).toEqual({ series: seriesOfBook(series, a1.id), book: a1 })
  expect(heroPick(series, {})?.series.title).toBe('B')
  expect(heroPick([], {})).toBeNull()
})

test('readingHistory lists opened books newest first, without reset ones', () => {
  const series = catalog(f('/Ebook/S/T1.cbz'), f('/Ebook/S/T2.cbz'), f('/Ebook/Dune.epub'))
  const [t1, t2] = series.find((s) => s.title === 'S')!.books
  const dune = series.find((s) => s.title === 'Dune')!.books[0]
  const history = readingHistory(series, {
    [t1.id]: p(1, 1),
    [dune.id]: p(0.2, 3),
    [t2.id]: { cfi: '', percent: 0, updatedAt: 5, device: 'Mac' },
    'id:gone': p(0.5, 9),
  })
  expect(history.map((h) => h.book.title)).toEqual(['Dune', 'T1'])
  expect(history[1].series.title).toBe('S')
})
