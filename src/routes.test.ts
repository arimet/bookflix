import { expect, test } from 'vitest'
import { parseHash } from './routes'

test('parseHash maps every screen', () => {
  expect(parseHash('')).toEqual({ name: 'home' })
  expect(parseHash('#/')).toEqual({ name: 'home' })
  expect(parseHash('#/bd')).toEqual({ name: 'kind', kind: 'comics' })
  expect(parseHash('#/livres')).toEqual({ name: 'kind', kind: 'books' })
  expect(parseHash('#/recherche')).toEqual({ name: 'search' })
  expect(parseHash('#/historique')).toEqual({ name: 'history' })
  expect(parseHash('#/demandes')).toEqual({ name: 'requests' })
  expect(parseHash('#/read/id%3Aabc')).toEqual({ name: 'read', bookId: 'id:abc' })
})

test('a series key can hold slashes', () => {
  expect(parseHash(`#/serie/${encodeURIComponent('Mangas/Boruto')}`)).toEqual({ name: 'series', key: 'Mangas/Boruto' })
  expect(parseHash('#/serie/Mangas/Boruto')).toEqual({ name: 'series', key: 'Mangas/Boruto' })
})

test('old folder links fall back to home', () => {
  expect(parseHash('#/folder/Mangas')).toEqual({ name: 'home' })
})
