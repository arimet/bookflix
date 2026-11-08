import { beforeEach, expect, test, vi } from 'vitest'
import type { Book } from '../library/library'
import { getBookBlob, localBookBlob } from '../offline/offline'
import { openArchive, openBook } from './openBook'
import { createAppReader } from './createAppReader'
import { openReader } from './openReader'
import { createLocalArchive, createRemoteArchive } from './remoteZip'

vi.mock('../offline/offline', () => ({ localBookBlob: vi.fn(), getBookBlob: vi.fn() }))
vi.mock('./remoteZip', () => ({ createRemoteArchive: vi.fn(async () => ({ remote: true })), createLocalArchive: vi.fn(async () => ({ local: true })) }))
vi.mock('./openBook', () => {
  const opened = { manifest: {}, getResource: vi.fn(), archive: {}, close: vi.fn() }
  return { openBook: vi.fn(async () => opened), openArchive: vi.fn(async () => opened) }
})
vi.mock('./openEpub', () => ({ openEpub: vi.fn() }))
vi.mock('./createAppReader', () => ({ createAppReader: vi.fn(() => ({})), createPdfReader: vi.fn(() => ({})) }))

const book = (format: Book['format']): Book => ({
  id: 'id:b', title: 'b', format, folder: '', file: { id: 'id:b', name: `b.${format}`, path: '/Ebook/b', size: 1, rev: 'r', serverModified: 'd' },
})

beforeEach(() => vi.clearAllMocks())

test('a CBZ not on the device opens straight from Dropbox, page by page', async () => {
  vi.mocked(localBookBlob).mockResolvedValue(null)
  await openReader(book('cbz'), 'rtl', undefined)
  expect(createRemoteArchive).toHaveBeenCalled()
  expect(openArchive).toHaveBeenCalledWith({ remote: true }, 'rtl')
  expect(getBookBlob).not.toHaveBeenCalled()
})

test('a CBZ already on the device opens from the local copy, page by page', async () => {
  const blob = new Blob(['x'])
  vi.mocked(localBookBlob).mockResolvedValue(blob)
  await openReader(book('cbz'), 'rtl', undefined)
  expect(createLocalArchive).toHaveBeenCalledWith(expect.objectContaining({ id: 'id:b' }), blob)
  expect(openArchive).toHaveBeenCalledWith({ local: true }, 'rtl')
  expect(openBook).not.toHaveBeenCalled()
  expect(createRemoteArchive).not.toHaveBeenCalled()
})

test('a CBZ on the device that cannot be read by ranges fails, never unzipped whole', async () => {
  vi.mocked(localBookBlob).mockResolvedValue(new Blob(['x']))
  vi.mocked(createLocalArchive).mockRejectedValueOnce(new Error('Corrupted zip'))
  await expect(openReader(book('cbz'), 'rtl', undefined)).rejects.toThrow('Corrupted zip')
  expect(openBook).not.toHaveBeenCalled()
})

test('a CBZ falls back to a full download when range reading fails', async () => {
  vi.mocked(localBookBlob).mockResolvedValue(null)
  vi.mocked(createRemoteArchive).mockRejectedValueOnce(new Error('Dropbox ignored the byte range'))
  vi.mocked(getBookBlob).mockResolvedValue(new Blob(['x']))
  await openReader(book('cbz'), 'rtl', undefined)
  expect(getBookBlob).toHaveBeenCalled()
})

test('a book opens page by page unless set to scroll', async () => {
  vi.mocked(localBookBlob).mockResolvedValue(null)
  await openReader(book('cbz'), 'rtl', undefined)
  expect(createAppReader).toHaveBeenLastCalledWith(expect.objectContaining({ pageTurnMode: 'controlled' }))
  await openReader(book('cbz'), 'rtl', undefined, 'scroll')
  expect(createAppReader).toHaveBeenLastCalledWith(expect.objectContaining({ pageTurnMode: 'scrollable' }))
})
