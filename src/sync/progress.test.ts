import { beforeEach, expect, test, vi } from 'vitest'
import { readJson, writeJson } from '../dropbox/api'
import { flushPending, loadProgress, localProgress, mergeProgress, recordProgress, resetProgress, type ProgressEntry } from './progress'

vi.mock('../dropbox/api', () => ({ readJson: vi.fn(), writeJson: vi.fn() }))

const e = (updatedAt: number): ProgressEntry => ({ cfi: `cfi${updatedAt}`, percent: 0.1, updatedAt, device: 'Mac' })

beforeEach(() => {
  localStorage.clear()
  vi.mocked(readJson).mockReset()
  vi.mocked(writeJson).mockReset()
})

test('mergeProgress keeps newest per book', () => {
  expect(mergeProgress({ x: e(2), y: e(1) }, { x: e(1), y: e(3), z: e(4) })).toEqual({ x: e(2), y: e(3), z: e(4) })
})

test('flushPending merges with remote', async () => {
  vi.mocked(readJson).mockResolvedValue({ x: e(5) })
  vi.mocked(writeJson).mockResolvedValue()
  recordProgress('p1', 'x', e(3))
  recordProgress('p1', 'y', e(4))

  await flushPending('p1')

  expect(writeJson).toHaveBeenCalledWith('/progress/p1.json', { x: e(5), y: e(4) })
  vi.mocked(writeJson).mockClear()
  await flushPending('p1')
  expect(writeJson).not.toHaveBeenCalled()
})

test('flushPending keeps pending on network error', async () => {
  vi.mocked(readJson).mockResolvedValue(null)
  vi.mocked(writeJson).mockRejectedValueOnce(new TypeError('Failed to fetch'))
  recordProgress('p1', 'x', e(3))

  await expect(flushPending('p1')).rejects.toThrow()

  vi.mocked(writeJson).mockResolvedValue()
  await flushPending('p1')
  expect(writeJson).toHaveBeenLastCalledWith('/progress/p1.json', { x: e(3) })
})

test('loadProgress merges remote and local, falls back to local offline', async () => {
  recordProgress('p1', 'x', e(3))
  vi.mocked(readJson).mockResolvedValueOnce({ x: e(1), y: e(2) })
  expect(await loadProgress('p1')).toEqual({ x: e(3), y: e(2) })

  vi.mocked(readJson).mockRejectedValueOnce(new TypeError('Failed to fetch'))
  expect(await loadProgress('p1')).toEqual({ x: e(3), y: e(2) })
})

test('resetProgress wins over the old position on every device and is synced', async () => {
  recordProgress('p1', 'x', e(3))
  resetProgress('p1', 'x', 'Mac')
  const reset = localProgress('p1').x
  expect(reset.cfi).toBe('')
  expect(reset.percent).toBe(0)
  expect(mergeProgress({ x: e(3) }, { x: reset }).x).toBe(reset)

  vi.mocked(readJson).mockResolvedValue({ x: e(3) })
  vi.mocked(writeJson).mockResolvedValue()
  await flushPending('p1')
  expect(vi.mocked(writeJson).mock.calls[0][1]).toEqual({ x: reset })
})
