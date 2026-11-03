import { beforeEach, expect, test, vi } from 'vitest'
import { DropboxError, dropboxArg, downloadBook, downloadBookRange, folderExists, isTeamAccount, listFolders, listLibrary, readJson, writeJson, type DbxFile } from './api'

vi.mock('./auth', () => ({ getAccessToken: async (app: string) => `token-${app}`, logout: vi.fn(), AuthError: class extends Error {} }))

const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

const file = (name: string) => ({
  '.tag': 'file', id: `id:${name}`, name, path_display: `/Ebook/${name}`, size: 1, rev: 'r', server_modified: 'd',
})
const auth = (call: number) => fetchMock.mock.calls[call][1].headers.Authorization

test('listLibrary lists /Ebook recursively with the read-only app and follows the cursor', async () => {
  fetchMock
    .mockResolvedValueOnce(Response.json({ entries: [file('a.cbz'), { '.tag': 'folder', name: 'S' }], has_more: true, cursor: 'c1' }))
    .mockResolvedValueOnce(Response.json({ entries: [file('b.epub')], has_more: false, cursor: 'c2' }))

  const { files, cursor } = await listLibrary('/Ebook')

  expect(cursor).toBe('c2')
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ path: '/Ebook', recursive: true, limit: 2000 })
  expect(auth(0)).toBe('Bearer token-library')
  expect(files.map((f) => f.name)).toEqual(['a.cbz', 'b.epub'])
  expect(files[0]).toEqual({ id: 'id:a.cbz', name: 'a.cbz', path: '/Ebook/a.cbz', size: 1, rev: 'r', serverModified: 'd' })
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ cursor: 'c1' })
})

const known = (path: string): DbxFile => ({ id: `id:${path}`, name: path.split('/').pop()!, path, size: 1, rev: 'r', serverModified: 'd' })

test('listLibrary with a cursor only fetches what changed', async () => {
  fetchMock.mockResolvedValueOnce(
    Response.json({
      entries: [file('new.epub'), { '.tag': 'deleted', name: 'Old', path_lower: '/ebook/old' }, { '.tag': 'deleted', name: 'x.pdf', path_lower: '/ebook/x.pdf' }],
      has_more: false,
      cursor: 'c9',
    }),
  )
  const before = { files: [known('/Ebook/Old/a.cbz'), known('/Ebook/x.pdf'), known('/Ebook/keep.cbz')], cursor: 'c8', root: '/Ebook' }

  const after = await listLibrary('/Ebook', before)

  expect(fetchMock.mock.calls[0][0]).toBe('https://api.dropboxapi.com/2/files/list_folder/continue')
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ cursor: 'c8' })
  expect(after.files.map((f) => f.path).sort()).toEqual(['/Ebook/keep.cbz', '/Ebook/new.epub'])
  expect(after.cursor).toBe('c9')
})

test('listLibrary starts over when Dropbox resets the cursor', async () => {
  fetchMock
    .mockResolvedValueOnce(Response.json({ error_summary: 'reset/..' }, { status: 409 }))
    .mockResolvedValueOnce(Response.json({ entries: [file('a.cbz')], has_more: false, cursor: 'c1' }))
  const after = await listLibrary('/Ebook', { files: [known('/Ebook/gone.cbz')], cursor: 'old', root: '/Ebook' })
  expect(after.files.map((f) => f.name)).toEqual(['a.cbz'])
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ path: '/Ebook', recursive: true, limit: 2000 })
})

test('books are downloaded with the read-only app', async () => {
  fetchMock.mockResolvedValueOnce(new Response('x'))
  await downloadBook('id:a')
  expect(auth(0)).toBe('Bearer token-library')
})

test('downloadBookRange asks Dropbox for just those bytes', async () => {
  fetchMock.mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 206 }))
  const bytes = await downloadBookRange('id:a', 100, 3)
  expect(fetchMock.mock.calls[0][1].headers.Range).toBe('bytes=100-102')
  expect(auth(0)).toBe('Bearer token-library')
  expect([...bytes]).toEqual([1, 2, 3])
})

test('downloadBookRange refuses a whole-file answer', async () => {
  fetchMock.mockResolvedValueOnce(new Response(new Uint8Array(10), { status: 200 }))
  await expect(downloadBookRange('id:a', 0, 3)).rejects.toThrow()
})

test('sync files are read and written with the sync app', async () => {
  fetchMock.mockResolvedValueOnce(new Response('{"a":1}')).mockResolvedValueOnce(new Response('{}'))
  expect(await readJson('/profiles.json')).toEqual({ a: 1 })
  await writeJson('/profiles.json', [])
  expect(auth(0)).toBe('Bearer token-sync')
  expect(auth(1)).toBe('Bearer token-sync')
})

test('readJson returns null on path/not_found', async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ error_summary: 'path/not_found/..' }, { status: 409 }))
  expect(await readJson('/profiles.json')).toBeNull()
})

test('readJson throws on other errors', async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ error_summary: 'too_many_requests/' }, { status: 429 }))
  await expect(readJson('/x.json')).rejects.toThrow('too_many_requests')
})

test('dropboxArg escapes non-ascii', () => {
  expect(dropboxArg({ path: '/Été' })).toBe('{"path":"/\\u00c9t\\u00e9"}')
})

test('listLibrary lists the given root', async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ entries: [], has_more: false, cursor: 'c1' }))
  const listing = await listLibrary('/Livres')
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ path: '/Livres', recursive: true, limit: 2000 })
  expect(listing.root).toBe('/Livres')
})

test('listLibrary starts over when the root changed', async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ entries: [], has_more: false, cursor: 'c1' }))
  const after = await listLibrary('/Livres', { files: [known('/Ebook/a.cbz')], cursor: 'old', root: '/Ebook' })
  expect(fetchMock.mock.calls[0][0]).toBe('https://api.dropboxapi.com/2/files/list_folder')
  expect(after.files).toEqual([])
})

test('listFolders keeps folders only, sorted', async () => {
  const folder = (name: string) => ({ '.tag': 'folder', name, path_display: `/${name}` })
  fetchMock
    .mockResolvedValueOnce(Response.json({ entries: [folder('B'), file('a.cbz')], has_more: true, cursor: 'c1' }))
    .mockResolvedValueOnce(Response.json({ entries: [folder('A 10'), folder('A 2')], has_more: false, cursor: 'c2' }))
  const folders = await listFolders('')
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ path: '', recursive: false, limit: 2000 })
  expect(folders).toEqual([{ name: 'A 2', path: '/A 2' }, { name: 'A 10', path: '/A 10' }, { name: 'B', path: '/B' }])
})

test('folderExists is false on path/not_found', async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ error_summary: 'path/not_found/..' }, { status: 409 }))
  expect(await folderExists('/Ebook')).toBe(false)
})

test('folderExists is true for a folder only', async () => {
  fetchMock
    .mockResolvedValueOnce(Response.json({ '.tag': 'folder', name: 'Ebook' }))
    .mockResolvedValueOnce(Response.json({ '.tag': 'file', name: 'Ebook' }))
  expect(await folderExists('/Ebook')).toBe(true)
  expect(await folderExists('/Ebook')).toBe(false)
})

test('folderExists lets other errors through', async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ error_summary: 'too_many_requests/' }, { status: 429 }))
  expect(await folderExists('/Ebook').catch((e) => e)).toBeInstanceOf(DropboxError)
})

test('isTeamAccount reads root_info', async () => {
  fetchMock
    .mockResolvedValueOnce(Response.json({ root_info: { '.tag': 'team' } }))
    .mockResolvedValueOnce(Response.json({ root_info: { '.tag': 'user' } }))
  expect(await isTeamAccount()).toBe(true)
  expect(fetchMock.mock.calls[0][0]).toBe('https://api.dropboxapi.com/2/users/get_current_account')
  expect(auth(0)).toBe('Bearer token-library')
  expect(await isTeamAccount()).toBe(false)
})

test('listLibrary reports a books folder deleted since the last listing as missing', async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ entries: [{ '.tag': 'deleted', name: 'Ebook', path_lower: '/ebook' }], has_more: false, cursor: 'c9' }))
  const error = await listLibrary('/Ebook', { files: [known('/Ebook/a.cbz')], cursor: 'c8', root: '/Ebook' }).catch((e) => e)
  expect(error).toBeInstanceOf(DropboxError)
  expect(error.message.startsWith('path/not_found')).toBe(true)
})
