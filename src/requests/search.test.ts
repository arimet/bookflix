import { afterEach, expect, test, vi } from 'vitest'
import { bookDescription, searchBooks } from './search'

afterEach(() => vi.unstubAllGlobals())

// A real answer of the BnF catalogue for "cité en flammes" + "winslow" (one record).
import bnfXml from './bnf-fixture.xml?raw'
const openLibrary = (docs: object[]) => Response.json({ docs })

const route = (bnf: string, ol: object[]) =>
  vi.fn(async (url: string) => (String(url).includes('catalogue.bnf.fr') ? new Response(bnf) : openLibrary(ol)))

test('French editions come from the BnF catalogue, with their cover', async () => {
  vi.stubGlobal('fetch', route(bnfXml, []))
  const [book] = (await searchBooks('La Cité en flammes Don Winslow')).books
  expect(book).toMatchObject({ title: 'La cité en flammes', authors: ['Don Winslow'], year: 2022 })
  expect(book.id).toMatch(/^bnf:ark:\/12148\//)
  expect(book.cover).toMatch(/^https:\/\/catalogue\.bnf\.fr\/couverture\?.*idArk=ark:\/12148\//)
  expect(book.isbn).toMatch(/^97[89]\d{10}$/)
})

test('Open Library results are mapped too', async () => {
  vi.stubGlobal('fetch', route('<x/>', [
    { key: '/works/OL1W', title: 'City on Fire', author_name: ['Don Winslow'], first_publish_year: 2022, cover_i: 42,
      isbn: ['0062851195', '9780062851192'], publisher: ['William Morrow'], number_of_pages_median: 384 },
  ]))
  expect((await searchBooks('city on fire')).books).toEqual([{
    id: '/works/OL1W', title: 'City on Fire', authors: ['Don Winslow'], year: 2022,
    cover: 'https://covers.openlibrary.org/b/id/42-L.jpg', isbn: '9780062851192', publisher: 'William Morrow', pages: 384,
  }])
})

test('the best title matches come first, whatever the catalogue', async () => {
  vi.stubGlobal('fetch', route(bnfXml, [
    { key: '/works/OL9W', title: 'Summary of Don Winslow City on Fire', author_name: ['Someone'] },
    { key: '/works/OL1W', title: 'La Cité en flammes', author_name: ['Don Winslow'] },
  ]))
  const titles = (await searchBooks('cité en flammes')).books.map((b) => b.title)
  expect(titles.slice(0, 1)).toEqual(['La cité en flammes'])
  expect(titles.filter((t) => t.toLowerCase() === 'la cité en flammes')).toHaveLength(1) // same book from both: kept once
  expect(titles).not.toContain('Summary of Don Winslow City on Fire') // no word of the query in it
})

test('one catalogue down does not break the search, and is reported', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => (String(url).includes('bnf') ? new Response('', { status: 503 }) : openLibrary([{ key: '/works/OL1W', title: 'Dune' }]))))
  const { books, unavailable } = await searchBooks('dune')
  expect(books.map((b) => b.title)).toEqual(['Dune'])
  expect(unavailable).toEqual(['BnF'])
})

test('results sharing no meaningful word with the query are dropped', async () => {
  vi.stubGlobal('fetch', route('<x/>', [
    { key: '/works/OL1W', title: 'Carnet de voyage à Carthage', author_name: ['Gustave Flaubert'] },
    { key: '/works/OL2W', title: 'La vie en rose' }, // shares only "la" and "en"
    { key: '/works/OL3W', title: 'Cités en flammes' },
  ]))
  expect((await searchBooks('La Cité en flammes')).books.map((b) => b.title)).toEqual(['Cités en flammes'])
})

test("an author's name in the query keeps that author's books", async () => {
  vi.stubGlobal('fetch', route('<x/>', [{ key: '/works/OL1W', title: 'Cartel', author_name: ['Don Winslow'] }]))
  expect((await searchBooks('winslow')).books.map((b) => b.title)).toEqual(['Cartel'])
})

test('searchBooks does not call anything for an empty query', async () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  expect(await searchBooks('   ')).toEqual({ books: [], unavailable: [] })
  expect(fetch).not.toHaveBeenCalled()
})

test('bookDescription reads both description shapes of Open Library, and has none for BnF records', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ description: { type: '/type/text', value: 'Un résumé.' } })))
  expect(await bookDescription({ id: '/works/OL1W', title: 'x', authors: [] })).toBe('Un résumé.')
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ description: 'Texte simple' })))
  expect(await bookDescription({ id: '/works/OL1W', title: 'x', authors: [] })).toBe('Texte simple')
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  expect(await bookDescription({ id: 'bnf:ark:/12148/cb1', title: 'x', authors: [] })).toBeNull()
  expect(fetch).not.toHaveBeenCalled()
})

const googleVolume = {
  id: 'gb123',
  volumeInfo: {
    title: 'La Cité en flammes', authors: ['Don Winslow'], publisher: 'HarperCollins', publishedDate: '2022-03-02',
    description: '<p>Rhode Island, 1986.</p>', pageCount: 432,
    industryIdentifiers: [{ type: 'ISBN_10', identifier: '1033911438' }, { type: 'ISBN_13', identifier: '9791033911432' }],
    imageLinks: { thumbnail: 'http://books.google.com/books/content?id=gb123&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api' },
  },
}

test('with a key, Google Books is searched first and its summary comes with the result', async () => {
  vi.stubEnv('VITE_GOOGLE_BOOKS_KEY', 'K')
  const fetch = vi.fn(async (url: string) =>
    String(url).includes('googleapis') ? Response.json({ items: [googleVolume] }) : String(url).includes('bnf') ? new Response('<x/>') : openLibrary([]))
  vi.stubGlobal('fetch', fetch)
  const { books } = await searchBooks('cité en flammes')
  const googleUrl = new URL(fetch.mock.calls.map((c) => String(c[0])).find((u) => u.includes('googleapis'))!)
  expect(googleUrl.searchParams.get('key')).toBe('K')
  expect(books[0]).toEqual({
    id: 'gb:gb123', title: 'La Cité en flammes', authors: ['Don Winslow'], year: 2022, publisher: 'HarperCollins', pages: 432,
    isbn: '9791033911432', description: 'Rhode Island, 1986.',
    cover: 'https://books.google.com/books/content?id=gb123&printsec=frontcover&img=1&zoom=1&source=gbs_api',
  })
  vi.unstubAllEnvs()
})

test('Google Books is retried when it answers 503', async () => {
  vi.stubEnv('VITE_GOOGLE_BOOKS_KEY', 'K')
  let googleCalls = 0
  vi.stubGlobal('fetch', vi.fn(async (url: string) =>
    String(url).includes('googleapis') ? (++googleCalls < 3 ? new Response('', { status: 503 }) : Response.json({ items: [googleVolume] }))
      : String(url).includes('bnf') ? new Response('<x/>') : openLibrary([])))
  const { books, unavailable } = await searchBooks('cité en flammes')
  expect(googleCalls).toBe(3)
  expect(unavailable).toEqual([])
  expect(books[0].id).toBe('gb:gb123')
  vi.unstubAllEnvs()
})

test('when Google Books answers, the other catalogues are not called', async () => {
  vi.stubEnv('VITE_GOOGLE_BOOKS_KEY', 'K')
  const fetch = vi.fn(async (url: string) => (String(url).includes('googleapis') ? Response.json({ items: [googleVolume] }) : openLibrary([])))
  vi.stubGlobal('fetch', fetch)
  await searchBooks('cité en flammes')
  expect(fetch.mock.calls.every((c) => String(c[0]).includes('googleapis'))).toBe(true)
  vi.unstubAllEnvs()
})

test('when Google Books stays down, the BnF and Open Library take over, and it is reported', async () => {
  vi.stubEnv('VITE_GOOGLE_BOOKS_KEY', 'K')
  vi.stubGlobal('fetch', vi.fn(async (url: string) =>
    String(url).includes('googleapis') ? new Response('', { status: 503 }) : String(url).includes('bnf') ? new Response(bnfXml) : openLibrary([])))
  const { books, unavailable } = await searchBooks('cité en flammes')
  expect(unavailable).toEqual(['Google Books'])
  expect(books[0].id).toMatch(/^bnf:/)
  vi.unstubAllEnvs()
})

test('without a key, Google Books is not called', async () => {
  vi.stubEnv('VITE_GOOGLE_BOOKS_KEY', '')
  const fetch = route('<x/>', [])
  vi.stubGlobal('fetch', fetch)
  await searchBooks('dune')
  expect(fetch.mock.calls.some((c) => String(c[0]).includes('googleapis'))).toBe(false)
  vi.unstubAllEnvs()
})

test('bookDescription uses the summary already in the result', async () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  expect(await bookDescription({ id: 'gb:1', title: 'x', authors: [], description: 'Déjà là' })).toBe('Déjà là')
  expect(fetch).not.toHaveBeenCalled()
})
