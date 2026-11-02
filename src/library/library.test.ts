import { expect, test } from 'vitest'
import type { DbxFile } from '../dropbox/api'
import { allBooks, buildTree, findFolder, firstBook, formatOf, type Folder } from './library'

const f = (path: string): DbxFile => ({
  id: `id:${path}`, name: path.split('/').pop()!, path, size: 1, rev: 'r', serverModified: 'd',
})
const shape = (folder: Folder): unknown => ({
  books: folder.books.map((b) => b.title),
  ...Object.fromEntries(folder.folders.map((sub) => [sub.name, shape(sub)])),
})

test('buildTree mirrors the folders under /Ebook, whatever their depth', () => {
  const tree = buildTree([
    f('/Ebook/Dune.epub'),
    f('/Ebook/Mangas/Boruto/Tome 01.cbz'),
    f('/Ebook/Auteur/Titre (12)/livre.epub'),
  ])
  expect(shape(tree)).toEqual({
    books: ['Dune'],
    Auteur: { books: [], 'Titre (12)': { books: ['livre'] } },
    Mangas: { books: [], Boruto: { books: ['Tome 01'] } },
  })
})

test('the root is matched case-insensitively, as Dropbox paths are', () => {
  expect(shape(buildTree([f('/ebook/a.epub')]))).toEqual({ books: ['a'] })
})

test('folders and books use natural sort', () => {
  const tree = buildTree([f('/Ebook/S/Tome 10.cbz'), f('/Ebook/S/Tome 2.cbz'), f('/Ebook/Vol 10/a.pdf'), f('/Ebook/Vol 9/a.pdf')])
  expect(tree.folders.map((s) => s.name)).toEqual(['S', 'Vol 9', 'Vol 10'])
  expect(tree.folders[0].books.map((b) => b.title)).toEqual(['Tome 2', 'Tome 10'])
})

test('unsupported files are ignored and folders left empty disappear', () => {
  const tree = buildTree([f('/Ebook/Notes/a.txt'), f('/Ebook/S/a.mobi'), f('/Ebook/S/d.CBZ')])
  expect(shape(tree)).toEqual({ books: [], S: { books: ['d'] } })
})

test('books keep their Dropbox id and know their folder', () => {
  const book = buildTree([f('/Ebook/Mangas/Boruto/T1.cbz')]).folders[0].folders[0].books[0]
  expect(book.id).toBe('id:/Ebook/Mangas/Boruto/T1.cbz')
  expect(book.folder).toBe('Mangas/Boruto')
})

test('findFolder, firstBook and allBooks', () => {
  const tree = buildTree([f('/Ebook/Mangas/Boruto/T2.cbz'), f('/Ebook/Mangas/Boruto/T1.cbz'), f('/Ebook/x.epub')])
  expect(findFolder(tree, 'Mangas/Boruto')?.books).toHaveLength(2)
  expect(findFolder(tree, '')).toBe(tree)
  expect(findFolder(tree, 'Nope')).toBeUndefined()
  expect(firstBook(findFolder(tree, 'Mangas')!)?.title).toBe('T1')
  expect(allBooks(tree)).toHaveLength(3)
})

test('formatOf', () => {
  expect(formatOf('a.CBR')).toBe('cbr')
  expect(formatOf('a.mobi')).toBeNull()
})
