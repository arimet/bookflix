import type { Kind, Series } from './library/catalog'
import type { Book } from './library/library'

export type Route =
  | { name: 'home' }
  | { name: 'kind'; kind: Kind }
  | { name: 'search' }
  | { name: 'history' }
  | { name: 'requests' }
  | { name: 'series'; key: string }
  | { name: 'read'; bookId: string }

export function parseHash(hash: string): Route {
  const [name, ...rest] = hash.replace(/^#\/?/, '').split('/')
  const arg = decodeURIComponent(rest.join('/'))
  if (name === 'bd') return { name: 'kind', kind: 'comics' }
  if (name === 'livres') return { name: 'kind', kind: 'books' }
  if (name === 'recherche') return { name: 'search' }
  if (name === 'historique') return { name: 'history' }
  if (name === 'demandes') return { name: 'requests' }
  if (name === 'serie' && arg) return { name: 'series', key: arg }
  if (name === 'read' && arg) return { name: 'read', bookId: arg }
  return { name: 'home' }
}

export const seriesHref = (s: Series) => `#/serie/${encodeURIComponent(s.key)}`
export const readHref = (b: Book) => `#/read/${encodeURIComponent(b.id)}`
