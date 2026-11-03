import { beforeEach, expect, test, vi } from 'vitest'
import { DropboxError, folderExists, readJson, writeJson } from '../dropbox/api'
import { cachedLibraryRoot, folderName, isMissingFolder, resolveLibraryRoot, saveLibraryRoot } from './libraryRoot'

vi.mock('../dropbox/api', async (original) => ({
  ...(await original<typeof import('../dropbox/api')>()),
  readJson: vi.fn(),
  writeJson: vi.fn(async () => {}),
  folderExists: vi.fn(),
}))

beforeEach(() => {
  localStorage.clear()
  vi.mocked(readJson).mockReset()
  vi.mocked(writeJson).mockClear()
  vi.mocked(folderExists).mockReset()
})

test('the saved folder wins', async () => {
  vi.mocked(readJson).mockResolvedValue({ libraryRoot: '/Livres' })
  expect(await resolveLibraryRoot()).toEqual({ root: '/Livres' })
  expect(folderExists).not.toHaveBeenCalled()
  expect(cachedLibraryRoot()).toBe('/Livres')
})

test('an existing default is taken and saved', async () => {
  vi.mocked(readJson).mockResolvedValue(null)
  vi.mocked(folderExists).mockResolvedValue(true)
  expect(await resolveLibraryRoot()).toEqual({ root: '/Ebook' })
  expect(folderExists).toHaveBeenCalledWith('/Ebook')
  expect(writeJson).toHaveBeenCalledWith('/settings.json', { libraryRoot: '/Ebook' })
  expect(cachedLibraryRoot()).toBe('/Ebook')
})

test('no default asks to pick', async () => {
  vi.mocked(readJson).mockResolvedValue(null)
  vi.mocked(folderExists).mockResolvedValue(false)
  expect(await resolveLibraryRoot()).toEqual({ pick: true })
  expect(writeJson).not.toHaveBeenCalled()
})

test('offline falls back without saving', async () => {
  vi.mocked(readJson).mockRejectedValue(new TypeError('Failed to fetch'))
  expect(await resolveLibraryRoot()).toEqual({ root: '/Ebook' })
  expect(writeJson).not.toHaveBeenCalled()
})

test('offline keeps the folder cached on this device', async () => {
  localStorage.setItem('bookflix.libraryRoot', '/Livres')
  vi.mocked(readJson).mockRejectedValue(new TypeError('Failed to fetch'))
  expect(await resolveLibraryRoot()).toEqual({ root: '/Livres' })
})

test('saveLibraryRoot writes the setting, then the cache', async () => {
  await saveLibraryRoot('/A/Mangas')
  expect(writeJson).toHaveBeenCalledWith('/settings.json', { libraryRoot: '/A/Mangas' })
  expect(cachedLibraryRoot()).toBe('/A/Mangas')
})

test('folderName names the last folder, or Dropbox for the root', () => {
  expect(folderName('/A/Mangas')).toBe('Mangas')
  expect(folderName('')).toBe('Dropbox')
})

test('isMissingFolder spots a deleted or renamed folder', () => {
  expect(isMissingFolder(new DropboxError(409, 'path/not_found/..'))).toBe(true)
  expect(isMissingFolder(new DropboxError(409, 'reset/..'))).toBe(false)
  expect(isMissingFolder(new TypeError('x'))).toBe(false)
})
