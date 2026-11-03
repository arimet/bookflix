import { beforeEach, expect, test, vi } from 'vitest'
import { readJson, writeJson } from '../dropbox/api'
import { addProfile, checkPin, folderAccess, setProfilePin, updateProfile, type Profile } from './profiles'

vi.mock('../dropbox/api', () => ({ readJson: vi.fn(), writeJson: vi.fn() }))

const anna: Profile = { id: 'a', name: 'Anna', color: 'red' }
const ben: Profile = { id: 'b', name: 'Ben', color: 'blue' }

beforeEach(() => {
  vi.mocked(readJson).mockReset()
  vi.mocked(writeJson).mockReset()
  vi.mocked(writeJson).mockResolvedValue()
})

test('a profile without a PIN opens freely', async () => {
  expect(await checkPin(anna, '')).toBe(true)
})

test('setProfilePin stores only a hash, and checkPin accepts the right code only', async () => {
  vi.mocked(readJson).mockResolvedValue([anna, ben])
  await setProfilePin('a', '1234')
  const saved = vi.mocked(writeJson).mock.calls[0][1] as Profile[]
  expect(JSON.stringify(saved)).not.toContain('1234')
  expect(saved[1]).toEqual(ben)
  expect(await checkPin(saved[0], '1234')).toBe(true)
  expect(await checkPin(saved[0], '0000')).toBe(false)
})

test('the same PIN hashes differently for two profiles', async () => {
  vi.mocked(readJson).mockResolvedValue([anna, ben])
  await setProfilePin('a', '1234')
  vi.mocked(readJson).mockResolvedValue(vi.mocked(writeJson).mock.calls[0][1] as Profile[])
  await setProfilePin('b', '1234')
  const [a, b] = vi.mocked(writeJson).mock.calls[1][1] as Profile[]
  expect(a.pinHash).not.toBe(b.pinHash)
})

test('setProfilePin(null) removes the PIN', async () => {
  vi.mocked(readJson).mockResolvedValue([{ ...anna, pinHash: 'x' }])
  await setProfilePin('a', null)
  const [a] = vi.mocked(writeJson).mock.calls[0][1] as Profile[]
  expect(a.pinHash).toBeUndefined()
})

test('updateProfile changes the avatar of one profile and keeps the others', async () => {
  vi.mocked(readJson).mockResolvedValue([anna, ben])
  await updateProfile('b', { avatar: 'genre:dragon', color: '#ff7a45' })
  expect(vi.mocked(writeJson).mock.calls[0][1]).toEqual([anna, { ...ben, avatar: 'genre:dragon', color: '#ff7a45' }])
})

test('addProfile stores the chosen avatar', async () => {
  vi.mocked(readJson).mockResolvedValue([])
  const p = await addProfile('Zoé', '#2fbf71', 'face:wink')
  expect(p.avatar).toBe('face:wink')
  expect((vi.mocked(writeJson).mock.calls[0][1] as Profile[])[0].avatar).toBe('face:wink')
})

test('updateProfile can mark a profile as admin', async () => {
  vi.mocked(readJson).mockResolvedValue([anna, ben])
  await updateProfile('a', { admin: true })
  expect((vi.mocked(writeJson).mock.calls[0][1] as Profile[])[0]).toEqual({ ...anna, admin: true })
})

test('only the admin changes the books folder; without an admin, the profile is offered the role', () => {
  const me = { id: 'me', name: 'Moi', color: '#000' }
  const admin = { id: 'a', name: 'Admin', color: '#000', admin: true }
  expect(folderAccess({ ...me, admin: true }, [{ ...me, admin: true }])).toBe('change')
  expect(folderAccess(me, [me, admin])).toBe('ask-admin')
  expect(folderAccess(me, [me])).toBe('become-admin')
})
