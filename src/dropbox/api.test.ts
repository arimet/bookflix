import { beforeEach, expect, test, vi } from 'vitest'
import { dropboxArg, downloadBook, downloadBookRange, listLibrary, readJson, writeJson, type DbxFile } from './api'

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

  const { files, cursor } = await listLibrary()

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
  const before = { files: [known('/Ebook/Old/a.cbz'), known('/Ebook/x.pdf'), known('/Ebook/keep.cbz')], cursor: 'c8' }

  const after = await listLibrary(before)

  expect(fetchMock.mock.calls[0][0]).toBe('https://api.dropboxapi.com/2/files/list_folder/continue')
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ cursor: 'c8' })
  expect(after.files.map((f) => f.path).sort()).toEqual(['/Ebook/keep.cbz', '/Ebook/new.epub'])
  expect(after.cursor).toBe('c9')
})

test('listLibrary starts over when Dropbox resets the cursor', async () => {
  fetchMock
    .mockResolvedValueOnce(Response.json({ error_summary: 'reset/..' }, { status: 409 }))
    .mockResolvedValueOnce(Response.json({ entries: [file('a.cbz')], has_more: false, cursor: 'c1' }))
  const after = await listLibrary({ files: [known('/Ebook/gone.cbz')], cursor: 'old' })
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
