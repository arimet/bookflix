import { LIBRARY_ROOT } from '../config'
import { DropboxError, folderExists, readJson, writeJson } from '../dropbox/api'

// The household's books folder, kept with the profiles in the sync folder so every device uses the same one.
// The copy on this device lets the app start without waiting for Dropbox.
const PATH = '/settings.json'
const KEY = 'bookflix.libraryRoot'
type Settings = { libraryRoot?: string }

export const cachedLibraryRoot = () => localStorage.getItem(KEY)

export async function saveLibraryRoot(root: string): Promise<void> {
  await writeJson(PATH, { libraryRoot: root } satisfies Settings)
  localStorage.setItem(KEY, root)
}

// The saved folder, else the deployment's default when this Dropbox has it (so existing households
// never see the picker), else the picker. Offline, the folder known here or the default, saved nowhere.
export async function resolveLibraryRoot(): Promise<{ root: string } | { pick: true }> {
  try {
    const saved = (await readJson<Settings>(PATH))?.libraryRoot
    if (saved !== undefined) {
      localStorage.setItem(KEY, saved)
      return { root: saved }
    }
    if (!(await folderExists(LIBRARY_ROOT))) return { pick: true }
    await saveLibraryRoot(LIBRARY_ROOT)
    return { root: LIBRARY_ROOT }
  } catch (e) {
    if (e instanceof TypeError) return { root: cachedLibraryRoot() ?? LIBRARY_ROOT }
    throw e
  }
}

export const folderName = (root: string) => root.split('/').filter(Boolean).pop() ?? 'Dropbox'

export const isMissingFolder = (e: unknown) => e instanceof DropboxError && e.status === 409 && e.message.startsWith('path/not_found')

// Signing out forgets this device's copy; the setting itself stays in the Dropbox.
export const forgetLibraryRoot = () => localStorage.removeItem(KEY)
