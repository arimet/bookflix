import { readJson, writeJson } from '../dropbox/api'
import type { Format } from '../library/library'

export type Direction = 'ltr' | 'rtl'
// pages: turned one at a time, sideways; scroll: one long strip read from top to bottom.
export type Flow = 'pages' | 'scroll'
export type BookSetting = { direction?: Direction; flow?: Flow }
export type BookSettings = Record<string, BookSetting>

const PATH = '/books.json'

export const defaultDirection = (format: Format): Direction => (format === 'cbz' || format === 'cbr' ? 'rtl' : 'ltr')

export const cachedBookSettings = (): BookSettings => JSON.parse(localStorage.getItem('bookflix.books') ?? '{}')

export async function loadBookSettings(): Promise<BookSettings> {
  try {
    const settings = (await readJson<BookSettings>(PATH)) ?? {}
    localStorage.setItem('bookflix.books', JSON.stringify(settings))
    return settings
  } catch (e) {
    if (!(e instanceof TypeError)) throw e
    return cachedBookSettings()
  }
}

// Changing one setting of a book keeps its others.
export const withBookSetting = (settings: BookSettings, bookId: string, changes: BookSetting): BookSettings =>
  ({ ...settings, [bookId]: { ...settings[bookId], ...changes } })

export async function setBookSetting(bookId: string, changes: BookSetting): Promise<void> {
  const settings = withBookSetting((await readJson<BookSettings>(PATH)) ?? {}, bookId, changes)
  await writeJson(PATH, settings)
  localStorage.setItem('bookflix.books', JSON.stringify(settings))
}
