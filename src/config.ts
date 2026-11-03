// Public app keys (PKCE: no secret). "library" is a read-only Full Dropbox app that reads the books,
// "sync" is an App folder app that stores profiles, progress and covers. Books can never be written.
export const APP_KEYS = {
  library: import.meta.env.VITE_DROPBOX_LIBRARY_KEY ?? '',
  sync: import.meta.env.VITE_DROPBOX_SYNC_KEY ?? '',
}

export type DropboxApp = keyof typeof APP_KEYS

// The books folder proposed by default; each household can pick another one, kept in its sync folder (libraryRoot.ts).
export const LIBRARY_ROOT = import.meta.env.VITE_LIBRARY_ROOT || '/Ebook'
export const LIBRARY_NAME = LIBRARY_ROOT.split('/').filter(Boolean).pop() ?? 'Dropbox'

export const REDIRECT_URI = location.origin + import.meta.env.BASE_URL
