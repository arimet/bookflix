import { APP_KEYS, REDIRECT_URI, type DropboxApp } from '../config'

export class AuthError extends Error {
  app: DropboxApp
  constructor(app: DropboxApp, message: string) {
    super(message)
    this.app = app
  }
}

type Mode = 'redirect' | 'code'
type StoredAuth = { refreshToken: string; accessToken: string; expiresAt: number }

const authKey = (app: DropboxApp) => `bookflix.auth.${app}`
const verifierKey = (app: DropboxApp) => `bookflix.pkce.${app}`
const TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token'

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64url(new Uint8Array(digest))
}

// "code" mode survives the trip through Safari, so the verifier must outlive the tab.
const verifierStore = (mode: Mode) => (mode === 'code' ? localStorage : sessionStorage)

export async function startLogin(app: DropboxApp, mode: Mode): Promise<void> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)))
  verifierStore(mode).setItem(verifierKey(app), verifier)
  const params = new URLSearchParams({
    client_id: APP_KEYS[app],
    // Dropbox sends state back with the code: it tells which of the two apps is signing in.
    state: app,
    response_type: 'code',
    code_challenge: await pkceChallenge(verifier),
    code_challenge_method: 'S256',
    token_access_type: 'offline',
  })
  if (mode === 'redirect') params.set('redirect_uri', REDIRECT_URI)
  const url = `https://www.dropbox.com/oauth2/authorize?${params}`
  if (mode === 'redirect') location.assign(url)
  else window.open(url, '_blank')
}

async function postToken(app: DropboxApp, params: Record<string, string>) {
  const res = await fetch(TOKEN_URL, { method: 'POST', body: new URLSearchParams(params) })
  const json = await res.json()
  if (!res.ok) {
    if (json.error === 'invalid_grant') {
      logout(app)
      throw new AuthError(app, json.error_description ?? json.error)
    }
    throw new Error(json.error_description ?? json.error ?? `HTTP ${res.status}`)
  }
  return json as { access_token: string; expires_in: number; refresh_token?: string }
}

function save(app: DropboxApp, auth: StoredAuth) {
  localStorage.setItem(authKey(app), JSON.stringify(auth))
}

export async function finishLogin(app: DropboxApp, code: string, mode: Mode): Promise<void> {
  const store = verifierStore(mode)
  const verifier = store.getItem(verifierKey(app))
  if (!verifier) throw new Error('La connexion a expiré, recommence.')
  const params: Record<string, string> = {
    grant_type: 'authorization_code',
    code: code.trim(),
    client_id: APP_KEYS[app],
    code_verifier: verifier,
  }
  if (mode === 'redirect') params.redirect_uri = REDIRECT_URI
  const json = await postToken(app, params)
  store.removeItem(verifierKey(app))
  save(app, {
    refreshToken: json.refresh_token!,
    accessToken: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  })
}

const load = (app: DropboxApp): StoredAuth | null => JSON.parse(localStorage.getItem(authKey(app)) ?? 'null')

export async function getAccessToken(app: DropboxApp): Promise<string> {
  const auth = load(app)
  if (!auth) throw new AuthError(app, 'Not logged in')
  if (auth.expiresAt - 60_000 > Date.now()) return auth.accessToken
  const json = await postToken(app, {
    grant_type: 'refresh_token',
    refresh_token: auth.refreshToken,
    client_id: APP_KEYS[app],
  })
  save(app, { ...auth, accessToken: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 })
  return json.access_token
}

export const isLoggedIn = (app: DropboxApp) => load(app) !== null

export function logout(app: DropboxApp) {
  localStorage.removeItem(authKey(app))
}
