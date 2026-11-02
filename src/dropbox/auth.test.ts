import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { APP_KEYS } from '../config'
import { AuthError, getAccessToken, isLoggedIn, pkceChallenge, startLogin } from './auth'

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
