import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { APP_KEYS } from '../config'
import { isLoggedIn } from './auth'
import { completeLogin, LoginError, EXPIRED, MISMATCH, OFFLINE, startConnection } from './loginChain'

const store = (app: string, auth: object) =>
  localStorage.setItem(`bookflix.auth.${app}`, JSON.stringify({ refreshToken: 'R', accessToken: 'A', expiresAt: Date.now() + 3600_000, ...auth }))
const tokenFor = (accountId?: string) =>
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ access_token: 'A', expires_in: 14400, refresh_token: 'R', account_id: accountId })))
const assign = vi.fn()

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  assign.mockReset()
  vi.stubGlobal('location', { ...location, assign, origin: 'http://localhost:5273' })
  sessionStorage.setItem('bookflix.pkce.library', 'v')
  sessionStorage.setItem('bookflix.pkce.sync', 'v')
})
afterEach(() => vi.unstubAllGlobals())

test('the first authorization chains to the sync app', async () => {
  tokenFor('dbid:1')
  expect(await completeLogin('library', 'c', 'redirect')).toBe('next')
})

test('the second authorization finishes the connection', async () => {
  store('library', { accountId: 'dbid:1' })
  tokenFor('dbid:1')
  expect(await completeLogin('sync', 'c', 'redirect')).toBe('done')
})

test('two different accounts are refused', async () => {
  store('library', { accountId: 'dbid:1' })
  tokenFor('dbid:2')
  const error = await completeLogin('sync', 'c', 'redirect').catch((e) => e)
  expect(error).toBeInstanceOf(LoginError)
  expect(error.message).toBe(MISMATCH)
  expect(isLoggedIn('sync')).toBe(false)
  expect(localStorage.getItem('bookflix.forceReauth')).toBe('1')
})

test('the retry after a mismatch asks Dropbox for the account again', async () => {
  store('library', { accountId: 'dbid:1' })
  localStorage.setItem('bookflix.forceReauth', '1')
  await startConnection('redirect')
  const url = new URL(assign.mock.calls[0][0])
  expect(url.searchParams.get('client_id')).toBe(APP_KEYS.sync)
  expect(url.searchParams.get('force_reauthentication')).toBe('true')
  expect(localStorage.getItem('bookflix.forceReauth')).toBeNull()
})

test('a connection cut resumes at the missing app', async () => {
  store('library', { accountId: 'dbid:1' })
  await startConnection('redirect')
  expect(new URL(assign.mock.calls[0][0]).searchParams.get('client_id')).toBe(APP_KEYS.sync)
})

test('a new connection starts with the library app', async () => {
  await startConnection('redirect')
  expect(new URL(assign.mock.calls[0][0]).searchParams.get('client_id')).toBe(APP_KEYS.library)
})

test('an old library token without account id does not block', async () => {
  store('library', {})
  tokenFor('dbid:1')
  expect(await completeLogin('sync', 'c', 'redirect')).toBe('done')
})

test('a network failure is reported plainly', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
  const error = await completeLogin('library', 'c', 'redirect').catch((e) => e)
  expect(error).toBeInstanceOf(LoginError)
  expect(error.message).toBe(OFFLINE)
})

test('an expired or reused code asks to start over', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'invalid_grant', error_description: 'code doesn\'t exist' }, { status: 400 })))
  const error = await completeLogin('library', 'c', 'redirect').catch((e) => e)
  expect(error.message).toBe(EXPIRED)
})

test('a lost PKCE verifier asks to start over', async () => {
  sessionStorage.clear()
  const error = await completeLogin('library', 'c', 'redirect').catch((e) => e)
  expect(error.message).toBe(EXPIRED)
})
