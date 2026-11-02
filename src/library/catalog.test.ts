import { expect, test } from 'vitest'
import type { DbxFile } from '../dropbox/api'
import type { ProgressMap } from '../sync/progress'
import { buildSeries, heroPick, ofKind, readingHistory, recentlyAdded, resumeBook, searchSeries, seriesOfBook } from './catalog'
import { buildTree } from './library'

const f = (path: string, serverModified = '2026-01-01T00:00:00Z'): DbxFile => ({
  id: `id:${path}`, name: path.split('/').pop()!, path, size: 1, rev: 'r', serverModified,
})
const catalog = (...files: DbxFile[]) => buildSeries(buildTree(files))
const p = (percent: number, updatedAt: number) => ({ cfi: 'c', percent, updatedAt, device: 'Mac' })

test('every folder holding books is a series; a book at the root is a series alone', () => {
  const series = catalog(
    f('/Ebook/Dune.epub'),
    f('/Ebook/Mangas/Boruto/T1.cbz'),
    f('/Ebook/Mangas/Boruto/T2.cbz'),
    f('/Ebook/Mangas/Akira.cbz'),
  )
  expect(series.map((s) => [s.title, s.books.length]).sort()).toEqual([['Boruto', 2], ['Dune', 1], ['Mangas', 1]])
  expect(series.find((s) => s.title === 'Dune')!.key).toBe('book:id:/Ebook/Dune.epub')
  expect(series.find((s) => s.title === 'Boruto')!.key).toBe('Mangas/Boruto')
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
})

test('search ignores case and accents and also matches book titles', () => {
  const series = catalog(f('/Ebook/Les Misérables/Tome 1.epub'), f('/Ebook/Boruto/Héros.cbz'), f('/Ebook/X/y.pdf'))
  expect(searchSeries(series, 'miserables').map((s) => s.title)).toEqual(['Les Misérables'])
  expect(searchSeries(series, 'HEROS').map((s) => s.title)).toEqual(['Boruto'])
  expect(searchSeries(series, '  ')).toEqual([])
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
