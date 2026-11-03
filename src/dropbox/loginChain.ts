import type { DropboxApp } from '../config'
import { accountOf, AuthError, EXPIRED, finishLogin, isLoggedIn, logout, startLogin, type Mode } from './auth'

// One "Se connecter à Dropbox" button for two Dropbox apps: the read-only library app, then the sync app.
// Each return from Dropbox finishes one app and says whether the other one is still to do.

export { EXPIRED }
export const MISMATCH = 'Les deux autorisations doivent venir du même compte Dropbox. Recommence la seconde avec le bon compte.'
export const OFFLINE = 'Dropbox ne répond pas. Vérifie ta connexion et réessaie.'
const FORCE_REAUTH_KEY = 'bookflix.forceReauth'

export class LoginError extends Error {}

// Starts at the first app not connected yet, so a connection cut halfway resumes where it stopped.
export async function startConnection(mode: Mode): Promise<void> {
  if (!isLoggedIn('library')) return startLogin('library', mode)
  const forceReauth = localStorage.getItem(FORCE_REAUTH_KEY) === '1'
  localStorage.removeItem(FORCE_REAUTH_KEY)
  return startLogin('sync', mode, { forceReauth })
}

export async function completeLogin(app: DropboxApp, code: string, mode: Mode): Promise<'next' | 'done'> {
  try {
    await finishLogin(app, code, mode)
  } catch (e) {
    if (e instanceof TypeError) throw new LoginError(OFFLINE)
    if (e instanceof AuthError || (e as Error).message === EXPIRED) throw new LoginError(EXPIRED)
    throw e
  }
  if (!isLoggedIn('sync')) return 'next'
  const library = accountOf('library')
  const sync = accountOf('sync')
  // Signed in to another account on dropbox.com between the two screens: the books and the sync would not match.
  if (library && sync && library !== sync) {
    logout('sync')
    localStorage.setItem(FORCE_REAUTH_KEY, '1')
    throw new LoginError(MISMATCH)
  }
  return 'done'
}
