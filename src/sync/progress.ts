import { readJson, writeJson } from '../dropbox/api'

export type ProgressEntry = { cfi: string; percent: number; updatedAt: number; device: string }
export type ProgressMap = Record<string, ProgressEntry>

const remotePath = (profileId: string) => `/progress/${profileId}.json`
const localKey = (profileId: string) => `bookflix.progress.${profileId}`
const pendingKey = (profileId: string) => `bookflix.progress.${profileId}.pending`

export function mergeProgress(a: ProgressMap, b: ProgressMap): ProgressMap {
  const merged = { ...a }
  for (const [id, entry] of Object.entries(b)) {
    if (!merged[id] || entry.updatedAt > merged[id].updatedAt) merged[id] = entry
  }
  return merged
}

export const localProgress = (profileId: string): ProgressMap => JSON.parse(localStorage.getItem(localKey(profileId)) ?? '{}')
const writeLocal = (profileId: string, map: ProgressMap) => localStorage.setItem(localKey(profileId), JSON.stringify(map))

export function recordProgress(profileId: string, bookId: string, entry: ProgressEntry): void {
  writeLocal(profileId, mergeProgress(localProgress(profileId), { [bookId]: entry }))
  // A counter, not a flag: a record made while a flush is in flight keeps it pending.
  localStorage.setItem(pendingKey(profileId), String(Number(localStorage.getItem(pendingKey(profileId)) ?? 0) + 1))
}

// A reset is an entry like any other, newer than the old position, so it wins on every device.
export function resetProgress(profileId: string, bookId: string, device: string): void {
  recordProgress(profileId, bookId, { cfi: '', percent: 0, updatedAt: Date.now(), device })
}

export async function flushPending(profileId: string): Promise<void> {
  const pending = localStorage.getItem(pendingKey(profileId))
  if (!pending) return
  const merged = mergeProgress((await readJson<ProgressMap>(remotePath(profileId))) ?? {}, localProgress(profileId))
  await writeJson(remotePath(profileId), merged)
  writeLocal(profileId, mergeProgress(merged, localProgress(profileId)))
  if (localStorage.getItem(pendingKey(profileId)) === pending) localStorage.removeItem(pendingKey(profileId))
}

export async function loadProgress(profileId: string): Promise<ProgressMap> {
  let remote: ProgressMap = {}
  try {
    remote = (await readJson<ProgressMap>(remotePath(profileId))) ?? {}
  } catch (e) {
    if (!(e instanceof TypeError)) throw e // TypeError = offline; anything else is real
  }
  const merged = mergeProgress(remote, localProgress(profileId))
  writeLocal(profileId, merged)
  return merged
}

export function deviceName(): string {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iPad'
  if (/Macintosh/.test(ua)) return 'Mac'
  return 'Navigateur'
}
