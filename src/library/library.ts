import type { DbxFile } from '../dropbox/api'

export type Format = 'epub' | 'cbz' | 'cbr' | 'pdf'
// folder: path of the containing folder relative to the library root ('' for the root)
export type Book = { id: string; title: string; format: Format; folder: string; file: DbxFile }
export type Folder = { name: string; path: string; folders: Folder[]; books: Book[] }

const FORMATS: Format[] = ['epub', 'cbz', 'cbr', 'pdf']
const collator = new Intl.Collator('fr', { numeric: true })

export function formatOf(name: string): Format | null {
  const ext = name.split('.').pop()?.toLowerCase() as Format
  return FORMATS.includes(ext) ? ext : null
}

const emptyFolder = (name: string, path: string): Folder => ({ name, path, folders: [], books: [] })

export function buildTree(files: DbxFile[], root: string): Folder {
  const tree = emptyFolder('', '')
  const prefix = root.toLowerCase() + '/'
  for (const file of files) {
    const format = formatOf(file.name)
    if (!format || !file.path.toLowerCase().startsWith(prefix)) continue
    const segments = file.path.slice(prefix.length).split('/').slice(0, -1)
    let folder = tree
    for (const name of segments) {
      const path = folder.path ? `${folder.path}/${name}` : name
      let sub = folder.folders.find((f) => f.name === name)
      if (!sub) folder.folders.push((sub = emptyFolder(name, path)))
      folder = sub
    }
    folder.books.push({ id: file.id, title: file.name.replace(/\.[^.]+$/, ''), format, folder: folder.path, file })
  }
  const sort = (folder: Folder) => {
    folder.books.sort((a, b) => collator.compare(a.file.name, b.file.name))
    folder.folders.sort((a, b) => collator.compare(a.name, b.name))
    folder.folders.forEach(sort)
  }
  sort(tree)
  return tree
}

export function findFolder(tree: Folder, path: string): Folder | undefined {
  let folder: Folder | undefined = tree
  for (const name of path.split('/').filter(Boolean)) folder = folder?.folders.find((f) => f.name === name)
  return folder
}

export const firstBook = (folder: Folder): Book | undefined =>
  folder.books[0] ?? folder.folders.map(firstBook).find(Boolean)

export const allBooks = (folder: Folder): Book[] => [...folder.books, ...folder.folders.flatMap(allBooks)]
