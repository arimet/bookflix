import { readJson, writeJson } from '../dropbox/api'
import type { Series } from '../library/catalog'
import type { BookInfo } from './search'

export type RequestStatus = 'requested' | 'in_progress' | 'available' | 'refused'
export type BookRequest = {
  id: string
  profileId: string
  book: BookInfo
  note?: string
  status: RequestStatus
  adminNote?: string
  libraryBookId?: string // set once the book is in the library
  createdAt: number
  updatedAt: number
}

// Shared by every profile of the Dropbox, in the sync app folder.
const PATH = '/requests.json'
const LOCAL_KEY = 'bookflix.requests'
const isOpen = (r: BookRequest) => r.status === 'requested' || r.status === 'in_progress'

const STATUSES: RequestStatus[] = ['requested', 'in_progress', 'available', 'refused']

// The file can be edited by hand: an unknown status is read as a fresh request.
async function readRemote(): Promise<BookRequest[]> {
  const requests = (await readJson<BookRequest[]>(PATH)) ?? []
  return requests.map((r) => (STATUSES.includes(r.status) ? r : { ...r, status: 'requested' }))
}

async function write(requests: BookRequest[]) {
  await writeJson(PATH, requests)
  localStorage.setItem(LOCAL_KEY, JSON.stringify(requests))
}

export async function loadRequests(): Promise<BookRequest[]> {
  try {
    const requests = await readRemote()
    localStorage.setItem(LOCAL_KEY, JSON.stringify(requests))
    return requests
  } catch (e) {
    if (!(e instanceof TypeError)) throw e // offline: last known list
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]')
  }
}

export async function addRequest(profileId: string, book: BookInfo, note?: string): Promise<BookRequest> {
  const requests = await readRemote()
  const existing = requests.find((r) => r.profileId === profileId && r.book.id === book.id && isOpen(r))
  if (existing) return existing
  const now = Date.now()
  const request: BookRequest = { id: crypto.randomUUID(), profileId, book, ...(note?.trim() && { note: note.trim() }), status: 'requested', createdAt: now, updatedAt: now }
  await write([...requests, request])
  return request
}

// Read, change, write: a request edited on another device in the meantime is kept.
export async function updateRequest(id: string, changes: Partial<Pick<BookRequest, 'status' | 'adminNote' | 'libraryBookId'>>) {
  await write((await readRemote()).map((r) => (r.id === id ? { ...r, ...changes, updatedAt: Date.now() } : r)))
}

export async function removeRequest(id: string) {
  await write((await readRemote()).filter((r) => r.id !== id))
}

const norm = (s: string) => ` ${s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `

// An open request is fulfilled when a library book or series has exactly its title, or when the file path holds
// its title as whole words plus an author's surname ("Romans/Cartel - Don Winslow.epub").
export function availableMatches(requests: BookRequest[], series: Series[]): { requestId: string; bookId: string }[] {
  return requests.filter(isOpen).flatMap((r) => {
    const title = norm(r.book.title)
    const surnames = r.book.authors.map((a) => norm(a.split(/\s+/).at(-1) ?? ''))
    for (const s of series) {
      for (const b of s.books) {
        const path = norm(b.file.path)
        if (norm(b.title) === title || norm(s.key.split('/').at(-1)!) === title || (path.includes(title) && surnames.some((n) => n.trim() && path.includes(n)))) {
          return [{ requestId: r.id, bookId: b.id }]
        }
      }
    }
    return []
  })
}
