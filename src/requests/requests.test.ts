import { beforeEach, expect, test, vi } from 'vitest'
import { readJson, writeJson } from '../dropbox/api'
import type { DbxFile } from '../dropbox/api'
import { buildSeries } from '../library/catalog'
import { buildTree } from '../library/library'
import { addRequest, availableMatches, loadRequests, removeRequest, updateRequest, type BookRequest } from './requests'
import type { BookInfo } from './search'

vi.mock('../dropbox/api', () => ({ readJson: vi.fn(), writeJson: vi.fn() }))

const cartel: BookInfo = { id: '/works/OL1W', title: 'Cartel', authors: ['Don Winslow'] }
const saved = () => vi.mocked(writeJson).mock.calls.at(-1)![1] as BookRequest[]

beforeEach(() => {
  localStorage.clear()
  vi.mocked(readJson).mockReset()
  vi.mocked(writeJson).mockReset()
  vi.mocked(writeJson).mockResolvedValue()
})

test('addRequest appends a request for the profile', async () => {
  vi.mocked(readJson).mockResolvedValue(null)
  const r = await addRequest('p1', cartel, 'en français svp')
  expect(saved()).toEqual([r])
  expect(r).toMatchObject({ profileId: 'p1', book: cartel, note: 'en français svp', status: 'requested' })
})

test('asking twice for the same book returns the open request', async () => {
  const first = await (vi.mocked(readJson).mockResolvedValue(null), addRequest('p1', cartel))
  vi.mocked(readJson).mockResolvedValue([first])
  vi.mocked(writeJson).mockClear()
  expect(await addRequest('p1', cartel)).toEqual(first)
  expect(writeJson).not.toHaveBeenCalled()
})

test('updateRequest changes one request and keeps the others written meanwhile', async () => {
  const a = { id: 'a', profileId: 'p1', book: cartel, status: 'requested', createdAt: 1, updatedAt: 1 } as BookRequest
  const b = { ...a, id: 'b', profileId: 'p2' }
  vi.mocked(readJson).mockResolvedValue([a, b])
  await updateRequest('a', { status: 'refused', adminNote: 'Introuvable' })
  expect(saved()[0]).toMatchObject({ id: 'a', status: 'refused', adminNote: 'Introuvable' })
  expect(saved()[0].updatedAt).toBeGreaterThan(1)
  expect(saved()[1]).toEqual(b)
})

test('a request with an unknown status is read as requested', async () => {
  vi.mocked(readJson).mockResolvedValue([{ id: 'r1', profileId: 'p1', book: cartel, status: 'pending', createdAt: 1, updatedAt: 1 }])
  expect((await loadRequests())[0].status).toBe('requested')
})

test('removeRequest drops it', async () => {
  vi.mocked(readJson).mockResolvedValue([{ id: 'a' }, { id: 'b' }])
  await removeRequest('a')
  expect(saved().map((r) => r.id)).toEqual(['b'])
})

const f = (path: string): DbxFile => ({ id: `id:${path}`, name: path.split('/').pop()!, path, size: 1, rev: 'r', serverModified: 'd' })
const req = (title: string, authors: string[] = [], status: BookRequest['status'] = 'requested') =>
  ({ id: title, profileId: 'p', book: { id: title, title, authors }, status, createdAt: 1, updatedAt: 1 }) as BookRequest

test('availableMatches finds requested books that arrived in the library', () => {
  const series = buildSeries(buildTree([
    f('/Ebook/Romans/Cartel - Don Winslow.epub'),
    f('/Ebook/Mangas/Détective Conan/Tome 01.cbz'),
    f('/Ebook/Dune.epub'),
  ], '/Ebook'))
  const matches = availableMatches([
    req('Cartel', ['Don Winslow']), // title + author in the file name
    req('Detective Conan'), // series name, accents ignored
    req('Dune'), // exact title
    req('Dune Messiah'), // not there
    req('Hyperion', [], 'available'), // already handled
    req('Dune', [], 'refused'),
  ], series)
  expect(matches.map((m) => [m.requestId, m.bookId])).toEqual([
    ['Cartel', 'id:/Ebook/Romans/Cartel - Don Winslow.epub'],
    ['Detective Conan', 'id:/Ebook/Mangas/Détective Conan/Tome 01.cbz'],
    ['Dune', 'id:/Ebook/Dune.epub'],
  ])
})

test('a short title alone does not match a longer one by accident', () => {
  const series = buildSeries(buildTree([f('/Ebook/Dune Messiah.epub')], '/Ebook'))
  expect(availableMatches([req('Dune')], series)).toEqual([])
})
