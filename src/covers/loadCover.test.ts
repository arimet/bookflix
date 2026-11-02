import { beforeEach, expect, test, vi } from 'vitest'
import { DropboxError, downloadBook, downloadSync } from '../dropbox/api'
import type { Book } from '../library/library'
import { localBookBlob } from '../offline/offline'
import { createRemoteArchive } from '../reader/remoteZip'
import { findOrMakeCover } from './covers'
import { upload } from '../dropbox/api'

vi.mock('../dropbox/api', async (original) => ({
  ...(await original<typeof import('../dropbox/api')>()),
  downloadSync: vi.fn(),
  downloadBook: vi.fn(),
  upload: vi.fn(),
}))
vi.mock('../offline/offline', () => ({ localBookBlob: vi.fn(), getBookBlob: vi.fn() }))
vi.mock('../reader/remoteZip', () => ({ createRemoteArchive: vi.fn() }))
vi.mock('./extract', () => ({ extractCover: vi.fn(async () => new Blob(['cover'])), coverFromArchive: vi.fn(async () => null) }))

const book = (format: Book['format']): Book => ({
  id: 'id:b', title: 'b', format, folder: '', file: { id: 'id:b', name: `b.${format}`, path: `/Ebook/b.${format}`, size: 100_000_000, rev: 'r', serverModified: 'd' },
})

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('caches', { open: async () => ({ match: async () => undefined, put: vi.fn() }) })
  vi.mocked(downloadSync).mockRejectedValue(new DropboxError(409, 'path/not_found/'))
  vi.mocked(localBookBlob).mockResolvedValue(null)
})

test('a PDF never opened gets no cover, and is not downloaded for one', async () => {
  expect(await findOrMakeCover(book('pdf'))).toBeNull()
  expect(downloadBook).not.toHaveBeenCalled()
})

test('a CBZ cover is read from Dropbox by ranges, not by downloading the book', async () => {
  vi.mocked(createRemoteArchive).mockResolvedValue({ records: [], recordsByUri: new Map(), close: async () => {} })
  await findOrMakeCover(book('cbz'))
  expect(createRemoteArchive).toHaveBeenCalled()
  expect(downloadBook).not.toHaveBeenCalled()
})

test('offline, a book already on the device still gets its cover, without uploading it', async () => {
  vi.mocked(downloadSync).mockRejectedValue(new TypeError('Failed to fetch'))
  vi.mocked(localBookBlob).mockResolvedValue(new Blob(['book']))
  expect(await findOrMakeCover(book('pdf'))).not.toBeNull()
  expect(upload).not.toHaveBeenCalled()
})
