import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { APP_KEYS } from '../config'
import { accountOf, AuthError, finishLogin, getAccessToken, isLoggedIn, loginErrorFromUrl, pkceChallenge, startLogin } from './auth'

const store = (app: string, auth: object) => localStorage.setItem(`bookflix.auth.${app}`, JSON.stringify(auth))

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => vi.unstubAllGlobals())

test('pkceChallenge matches the RFC 7636 example', async () => {
  expect(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
    'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  )
})

test('each Dropbox app keeps its own token', async () => {
  vi.stubGlobal('fetch', vi.fn())
  store('library', { refreshToken: 'R1', accessToken: 'L', expiresAt: Date.now() + 3600_000 })
  store('sync', { refreshToken: 'R2', accessToken: 'S', expiresAt: Date.now() + 3600_000 })

  expect(await getAccessToken('library')).toBe('L')
  expect(await getAccessToken('sync')).toBe('S')
})

test('getAccessToken refreshes an expired token with that app key', async () => {
  const fetch = vi.fn(async () => Response.json({ access_token: 'B', expires_in: 14400 }))
  vi.stubGlobal('fetch', fetch)
  store('sync', { refreshToken: 'R', accessToken: 'A', expiresAt: Date.now() - 1 })

  expect(await getAccessToken('sync')).toBe('B')
  const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
  expect(url).toBe('https://api.dropboxapi.com/oauth2/token')
  expect(String(init.body)).toBe(`grant_type=refresh_token&refresh_token=R&client_id=${APP_KEYS.sync}`)
  expect(JSON.parse(localStorage.getItem('bookflix.auth.sync')!).accessToken).toBe('B')
})

test('getAccessToken throws AuthError naming the app on invalid_grant and logs it out', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'invalid_grant' }, { status: 400 })))
  store('library', { refreshToken: 'R', accessToken: 'A', expiresAt: 0 })
  store('sync', { refreshToken: 'R', accessToken: 'S', expiresAt: Date.now() + 3600_000 })

  const error = await getAccessToken('library').catch((e) => e)
  expect(error).toBeInstanceOf(AuthError)
  expect(error.app).toBe('library')
  expect(isLoggedIn('library')).toBe(false)
  expect(isLoggedIn('sync')).toBe(true)
})

test('startLogin tells Dropbox which app is signing in through state', async () => {
  const assign = vi.fn()
  vi.stubGlobal('location', { ...location, assign, origin: 'http://localhost:5273' })
  await startLogin('library', 'redirect')
  const url = new URL(assign.mock.calls[0][0])
  expect(url.searchParams.get('client_id')).toBe(APP_KEYS.library)
  expect(url.searchParams.get('state')).toBe('library')
})

test('finishLogin keeps the Dropbox account id', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ access_token: 'A', expires_in: 14400, refresh_token: 'R', account_id: 'dbid:1' })))
  sessionStorage.setItem('bookflix.pkce.library', 'verifier')
  await finishLogin('library', 'code', 'redirect')
  expect(accountOf('library')).toBe('dbid:1')
})

test('accountOf is null for a token saved before account ids', () => {
  store('library', { refreshToken: 'R', accessToken: 'A', expiresAt: Date.now() + 3600_000 })
  expect(accountOf('library')).toBeNull()
})

test('startLogin can force Dropbox to ask for the account again', async () => {
  const assign = vi.fn()
  vi.stubGlobal('location', { ...location, assign, origin: 'http://localhost:5273' })
  await startLogin('sync', 'redirect', { forceReauth: true })
  await startLogin('sync', 'redirect')
  expect(new URL(assign.mock.calls[0][0]).searchParams.get('force_reauthentication')).toBe('true')
  expect(new URL(assign.mock.calls[1][0]).searchParams.has('force_reauthentication')).toBe(false)
})

test('loginErrorFromUrl reads a cancelled authorization', () => {
  expect(loginErrorFromUrl(new URLSearchParams('error=access_denied&error_description=x&state=sync')))
    .toEqual({ app: 'sync', message: 'Connexion annulée.' })
})

test('loginErrorFromUrl passes other Dropbox errors through', () => {
  expect(loginErrorFromUrl(new URLSearchParams('error=server_error&error_description=Oops&state=library')))
    .toEqual({ app: 'library', message: 'Dropbox : Oops' })
})

test('loginErrorFromUrl ignores a normal return', () => {
  expect(loginErrorFromUrl(new URLSearchParams('code=abc&state=library'))).toBeNull()
})
