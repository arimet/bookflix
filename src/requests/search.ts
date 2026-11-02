// Book search on up to three catalogues: Google Books (needs VITE_GOOGLE_BOOKS_KEY, a key restricted to this site:
// the keyless quota is shared and often exhausted), the BnF for French editions (legal deposit), Open Library.
export type BookInfo = {
  id: string // Open Library work key ("/works/OL21102658W") or BnF record ("bnf:ark:/12148/cb47033552d")
  title: string
  authors: string[]
  year?: number
  cover?: string
  isbn?: string
  publisher?: string
  pages?: number
  description?: string // when the catalogue gives it with the search result
}

type Doc = {
  key: string
  title: string
  author_name?: string[]
  first_publish_year?: number
  cover_i?: number
  isbn?: string[]
  publisher?: string[]
  number_of_pages_median?: number
}

const FIELDS = 'key,title,author_name,first_publish_year,cover_i,isbn,publisher,number_of_pages_median'

type Volume = {
  id: string
  volumeInfo: {
    title: string
    subtitle?: string
    authors?: string[]
    publisher?: string
    publishedDate?: string
    description?: string
    pageCount?: number
    industryIdentifiers?: { type: string; identifier: string }[]
    imageLinks?: { thumbnail?: string }
  }
}

const googleKey = () => import.meta.env.VITE_GOOGLE_BOOKS_KEY as string | undefined
const plainText = (html: string) => new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim() ?? ''

async function searchGoogle(q: string): Promise<BookInfo[]> {
  const params = new URLSearchParams({ q, maxResults: '30', printType: 'books', key: googleKey()! })
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`)
  if (!res.ok) throw new Error(`Google Books ${res.status}`)
  const { items = [] } = (await res.json()) as { items?: Volume[] }
  return items.map(({ id, volumeInfo: v }) => {
    const ids = v.industryIdentifiers ?? []
    const isbn = (ids.find((i) => i.type === 'ISBN_13') ?? ids.find((i) => i.type === 'ISBN_10'))?.identifier
    const year = Number(v.publishedDate?.slice(0, 4))
    const cover = v.imageLinks?.thumbnail?.replace(/^http:/, 'https:').replace('&edge=curl', '')
    const description = v.description && plainText(v.description)
    return {
      id: `gb:${id}`,
      title: v.title,
      authors: v.authors ?? [],
      ...(year && { year }),
      ...(cover && { cover }),
      ...(isbn && { isbn }),
      ...(v.publisher && { publisher: v.publisher }),
      ...(v.pageCount && { pages: v.pageCount }),
      ...(description && { description }),
    }
  })
}

async function searchOpenLibrary(q: string): Promise<BookInfo[]> {
  const params = new URLSearchParams({ q, limit: '20', fields: FIELDS })
  const res = await fetch(`https://openlibrary.org/search.json?${params}`)
  if (!res.ok) throw new Error(`Open Library ${res.status}`)
  const { docs } = (await res.json()) as { docs: Doc[] }
  return docs.map((d) => {
    const isbn = d.isbn?.find((i) => i.length === 13) ?? d.isbn?.[0]
    return {
      id: d.key,
      title: d.title,
      authors: d.author_name ?? [],
      ...(d.first_publish_year && { year: d.first_publish_year }),
      ...(d.cover_i && { cover: `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` }),
      ...(isbn && { isbn }),
      ...(d.publisher?.[0] && { publisher: d.publisher[0] }),
      ...(d.number_of_pages_median && { pages: d.number_of_pages_median }),
    }
  })
}

// "Winslow, Don (1953-....). Auteur du texte" → "Don Winslow"
const bnfAuthor = (creator: string) => {
  const [last, first] = creator.replace(/\s*\(.*$/, '').replace(/\.\s*Auteur.*$/, '').split(', ')
  return first ? `${first} ${last}` : last
}

async function searchBnf(q: string): Promise<BookInfo[]> {
  const query = `bib.anywhere all "${q.replace(/"/g, ' ')}" and bib.doctype any "a"`
  const params = new URLSearchParams({ version: '1.2', operation: 'searchRetrieve', query, recordSchema: 'dublincore', maximumRecords: '20' })
  const res = await fetch(`https://catalogue.bnf.fr/api/SRU?${params}`)
  if (!res.ok) throw new Error(`BnF ${res.status}`)
  const doc = new DOMParser().parseFromString(await res.text(), 'application/xml')
  const DC = 'http://purl.org/dc/elements/1.1/'
  return [...doc.getElementsByTagNameNS('http://www.openarchives.org/OAI/2.0/oai_dc/', 'dc')].flatMap((record) => {
    const all = (tag: string) => [...record.getElementsByTagNameNS(DC, tag)].map((e) => e.textContent ?? '')
    const ark = all('identifier').find((i) => i.includes('ark:/'))?.match(/ark:\/\d+\/\w+/)?.[0]
    const title = all('title')[0]?.split(' / ')[0].trim()
    if (!ark || !title) return []
    const isbn = all('identifier').map((i) => i.match(/ISBN\s+([\dX-]+)/)?.[1]?.replace(/-/g, '')).find(Boolean)
    const year = Number(all('date')[0]?.match(/\d{4}/)?.[0])
    const pages = Number(all('format')[0]?.match(/(\d+)\s*p\./)?.[1])
    const publisher = all('publisher')[0]?.replace(/\s*\(.*\)\s*$/, '')
    return [{
      id: `bnf:${ark}`,
      title,
      authors: all('creator').filter((c) => /Auteur/.test(c)).map(bnfAuthor),
      ...(year && { year }),
      cover: `https://catalogue.bnf.fr/couverture?&appName=NE&idArk=${ark}&couverture=1`,
      ...(isbn && { isbn }),
      ...(publisher && { publisher }),
      ...(pages && { pages }),
    }]
  })
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
const words = (s: string) => fold(s).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1)
// Small words that every other title shares: they neither rank nor keep a result.
const STOPWORDS = new Set('le la les de des du en et un une au aux sur pour par dans the of an and in on to for'.split(' '))
const meaningful = (s: string) => words(s).filter((w) => !STOPWORDS.has(w))

export type SearchResult = { books: BookInfo[]; unavailable: string[] }

// Both catalogues at once; one down only removes its results, and is reported. A result must share a
// meaningful word with the query (in its title or an author's name). Titles holding most query words come
// first, exact titles ahead; the same book found twice (title + first author) is kept once, BnF first.
export async function searchBooks(query: string): Promise<SearchResult> {
  const q = query.trim().replace(/\s+/g, ' ')
  if (!q) return { books: [], unavailable: [] }
  const sources = [
    ...(googleKey() ? [{ name: 'Google Books', search: searchGoogle }] : []),
    { name: 'BnF', search: searchBnf },
    { name: 'Open Library', search: searchOpenLibrary },
  ]
  const settled = await Promise.allSettled(sources.map((source) => source.search(q)))
  const unavailable = sources.filter((_, i) => settled[i].status === 'rejected').map((source) => source.name)
  if (unavailable.length === sources.length) throw new Error('Les catalogues de livres ne répondent pas pour le moment.')
  const found = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))

  const asked = new Set(meaningful(q))
  const score = (b: BookInfo) => {
    const title = meaningful(b.title)
    const hits = title.filter((w) => asked.has(w)).length
    const byAuthor = b.authors.some((a) => meaningful(a).some((w) => asked.has(w)))
    if (!hits && !byAuthor) return 0
    return hits / Math.max(1, asked.size) + (hits && hits === title.length ? 0.5 : 0) + (byAuthor ? 0.25 : 0)
  }
  const seen = new Set<string>()
  const books = found
    .map((book, order) => ({ book, order, score: score(book) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map((r) => r.book)
    .filter((b) => {
      const key = `${words(b.title).join(' ')}|${words(b.authors[0] ?? '').at(-1) ?? ''}`
      return !seen.has(key) && (seen.add(key), true)
    })
  return { books, unavailable }
}

export async function bookDescription(book: BookInfo): Promise<string | null> {
  if (book.description) return book.description
  if (!book.id.startsWith('/works/')) return null // BnF records have no summary; Google gave none
  const res = await fetch(`https://openlibrary.org${book.id}.json`)
  if (!res.ok) return null
  const { description } = (await res.json()) as { description?: string | { value: string } }
  return (typeof description === 'string' ? description : description?.value) ?? null
}
