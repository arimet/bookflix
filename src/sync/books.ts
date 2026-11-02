import { readJson, writeJson } from '../dropbox/api'
import type { Format } from '../library/library'

export type Direction = 'ltr' | 'rtl'
export type BookSettings = Record<string, { direction: Direction }>

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

export async function setBookDirection(bookId: string, direction: Direction): Promise<void> {
  const settings = (await readJson<BookSettings>(PATH)) ?? {}
  settings[bookId] = { direction }
  await writeJson(PATH, settings)
  localStorage.setItem('bookflix.books', JSON.stringify(settings))
}
