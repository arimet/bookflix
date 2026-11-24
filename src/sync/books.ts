import { readJson, writeJson } from '../dropbox/api'
import type { Format } from '../library/library'
import type { ProgressMap } from './progress'

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

// A book's settings; what it has not set itself comes from the volume of its series read last that has it
// (volumes: the ids of the series' books), so the next volume opens the way the previous one was read.
export function bookSetting(settings: BookSettings, bookId: string, volumes: string[], progress: ProgressMap): BookSetting {
  const others = volumes
    .filter((id) => id !== bookId && settings[id])
    .sort((a, b) => (progress[b]?.updatedAt ?? 0) - (progress[a]?.updatedAt ?? 0))
  const inherited = (key: keyof BookSetting) => settings[bookId]?.[key] ?? others.map((id) => settings[id][key]).find(Boolean)
  const direction = inherited('direction') as Direction | undefined
  const flow = inherited('flow') as Flow | undefined
  return { ...(direction && { direction }), ...(flow && { flow }) }
}

// Changing one setting of a book keeps its others.
export const withBookSetting = (settings: BookSettings, bookId: string, changes: BookSetting): BookSettings =>
  ({ ...settings, [bookId]: { ...settings[bookId], ...changes } })

export async function setBookSetting(bookId: string, changes: BookSetting): Promise<void> {
  const settings = withBookSetting((await readJson<BookSettings>(PATH)) ?? {}, bookId, changes)
  await writeJson(PATH, settings)
  localStorage.setItem('bookflix.books', JSON.stringify(settings))
}
