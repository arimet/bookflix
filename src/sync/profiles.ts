import { readJson, writeJson } from '../dropbox/api'

// pinHash: optional 4-digit code, stored hashed. It separates the readers sharing one Dropbox;
// anyone with that Dropbox access can still read the files, so it is not a security boundary.
// avatar: an id from src/components/avatars.ts ("face:…" or "genre:…"); without one, the initial is shown.
// admin: handles everyone's book requests (one admin per Dropbox).
export type Profile = { id: string; name: string; color: string; avatar?: string; pinHash?: string; admin?: boolean }

const PATH = '/profiles.json'
const CURRENT_KEY = 'bookflix.profile'

export async function loadProfiles(): Promise<Profile[]> {
  try {
    const profiles = (await readJson<Profile[]>(PATH)) ?? []
    localStorage.setItem('bookflix.profiles', JSON.stringify(profiles))
    return profiles
  } catch (e) {
    if (!(e instanceof TypeError)) throw e // offline: last known list
    return JSON.parse(localStorage.getItem('bookflix.profiles') ?? '[]')
  }
}

export async function addProfile(name: string, color: string, avatar?: string): Promise<Profile> {
  const profile: Profile = { id: crypto.randomUUID(), name: name.trim(), color, ...(avatar && { avatar }) }
  const profiles = [...((await readJson<Profile[]>(PATH)) ?? []), profile]
  await writeJson(PATH, profiles)
  localStorage.setItem('bookflix.profiles', JSON.stringify(profiles))
  return profile
}

export async function updateProfile(profileId: string, changes: Partial<Pick<Profile, 'avatar' | 'color' | 'admin'>>): Promise<void> {
  const profiles = ((await readJson<Profile[]>(PATH)) ?? []).map((p) => (p.id === profileId ? { ...p, ...changes } : p))
  await writeJson(PATH, profiles)
  localStorage.setItem('bookflix.profiles', JSON.stringify(profiles))
}

async function hashPin(profileId: string, pin: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`bookflix:${profileId}:${pin}`))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const checkPin = async (profile: Profile, pin: string) => !profile.pinHash || profile.pinHash === (await hashPin(profile.id, pin))

export async function setProfilePin(profileId: string, pin: string | null): Promise<void> {
  const profiles = (await readJson<Profile[]>(PATH)) ?? []
  const pinHash = pin ? await hashPin(profileId, pin) : undefined
  const next = profiles.map((p) => {
    if (p.id !== profileId) return p
    const { pinHash: _old, ...rest } = p
    return pinHash ? { ...rest, pinHash } : rest
  })
  await writeJson(PATH, next)
  localStorage.setItem('bookflix.profiles', JSON.stringify(next))
}

export const getCurrentProfileId = () => localStorage.getItem(CURRENT_KEY)

export function setCurrentProfileId(id: string | null) {
  if (id) localStorage.setItem(CURRENT_KEY, id)
  else localStorage.removeItem(CURRENT_KEY)
}

// The books folder is the household's: only its admin moves it. With no admin yet, whoever asks can become it.
export const folderAccess = (profile: Profile, profiles: Profile[]): 'change' | 'ask-admin' | 'become-admin' =>
  profile.admin ? 'change' : profiles.some((p) => p.admin) ? 'ask-admin' : 'become-admin'
