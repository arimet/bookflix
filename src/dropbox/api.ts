import { LIBRARY_ROOT, type DropboxApp } from '../config'
import { AuthError, getAccessToken, logout } from './auth'

export type DbxFile = { id: string; name: string; path: string; size: number; rev: string; serverModified: string }

const API = 'https://api.dropboxapi.com/2'
const CONTENT = 'https://content.dropboxapi.com/2'

// HTTP headers must be ASCII: Dropbox wants non-ASCII escaped as \uXXXX.
export const dropboxArg = (obj: unknown) =>
  JSON.stringify(obj).replace(/[\u007f-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))

async function call(app: DropboxApp, url: string, init: RequestInit & { headers?: Record<string, string> }) {
  const res = await fetch(url, {
    ...init,
    method: 'POST',
    headers: { ...init.headers, Authorization: `Bearer ${await getAccessToken(app)}` },
  })
  if (res.ok) return res
  if (res.status === 401) {
    logout(app)
    throw new AuthError(app, 'Dropbox rejected the token')
  }
  const text = await res.text()
  let summary = text
  try {
    summary = JSON.parse(text).error_summary ?? text
  } catch {
    // plain-text error body
  }
  throw new DropboxError(res.status, summary)
}

export class DropboxError extends Error {
  status: number
  constructor(status: number, summary: string) {
    super(summary)
    this.status = status
  }
}

const rpc = (app: DropboxApp, endpoint: string, body: unknown) =>
  call(app, `${API}${endpoint}`, { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

type RawEntry = {
  '.tag': string
  id: string
  name: string
  path_display: string
  path_lower: string
  size: number
  rev: string
  server_modified: string
}
export type LibraryListing = { files: DbxFile[]; cursor: string }

// With a cursor, Dropbox only sends what changed since the last listing: a reload costs one small call.
export async function listLibrary(previous?: LibraryListing): Promise<LibraryListing> {
  let page
  const files = new Map((previous?.files ?? []).map((f) => [f.path.toLowerCase(), f]))
  try {
    page = previous
      ? await (await rpc('library', '/files/list_folder/continue', { cursor: previous.cursor })).json()
      : undefined
  } catch (e) {
    if (!(e instanceof DropboxError && e.message.startsWith('reset'))) throw e
  }
  if (!page) {
    files.clear()
    page = await (await rpc('library', '/files/list_folder', { path: LIBRARY_ROOT, recursive: true, limit: 2000 })).json()
  }
  for (;;) {
    for (const e of page.entries as RawEntry[]) {
      if (e['.tag'] === 'deleted') {
        for (const key of files.keys()) if (key === e.path_lower || key.startsWith(e.path_lower + '/')) files.delete(key)
      } else if (e['.tag'] === 'file') {
        files.set(e.path_display.toLowerCase(), {
          id: e.id, name: e.name, path: e.path_display, size: e.size, rev: e.rev, serverModified: e.server_modified,
        })
      }
    }
    if (!page.has_more) return { files: [...files.values()], cursor: page.cursor }
    page = await (await rpc('library', '/files/list_folder/continue', { cursor: page.cursor })).json()
  }
}

async function download(app: DropboxApp, pathOrId: string): Promise<Blob> {
  const res = await call(app, `${CONTENT}/files/download`, { headers: { 'Dropbox-API-Arg': dropboxArg({ path: pathOrId }) } })
  return res.blob()
}

// Books: read-only app, whole Dropbox. Everything else: sync app, its own folder.
export const downloadBook = (id: string) => download('library', id)
// The response itself, for a caller that streams the body instead of holding it whole.
export const fetchBook = (id: string) => call('library', `${CONTENT}/files/download`, { headers: { 'Dropbox-API-Arg': dropboxArg({ path: id }) } })
export const downloadSync = (path: string) => download('sync', path)

export async function downloadBookRange(id: string, start: number, length: number): Promise<Uint8Array> {
  const res = await call('library', `${CONTENT}/files/download`, {
    headers: { 'Dropbox-API-Arg': dropboxArg({ path: id }), Range: `bytes=${start}-${start + length - 1}` },
  })
  if (res.status !== 206) {
    await res.body?.cancel()
    throw new Error('Dropbox ignored the byte range')
  }
  return new Uint8Array(await res.arrayBuffer())
}

export async function upload(path: string, body: Blob | string): Promise<void> {
  await call('sync', `${CONTENT}/files/upload`, {
    headers: {
      'Dropbox-API-Arg': dropboxArg({ path, mode: 'overwrite', mute: true }),
      'Content-Type': 'application/octet-stream',
    },
    body,
  })
}

export async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await (await downloadSync(path)).text()) as T
  } catch (e) {
    if (e instanceof DropboxError && e.status === 409 && e.message.startsWith('path/not_found')) return null
    throw e
  }
}

export const writeJson = (path: string, data: unknown) => upload(path, JSON.stringify(data))
