import { expect, test } from 'vitest'
import { positionRecorder } from './positionRecorder'

const pos = (cfi: string, status: 'pending' | 'success' = 'success') => ({ cfi, percentageEstimateOfBook: 0.5, status })

test('opening a book does not count as reading it', () => {
  const record = positionRecorder()
  expect(record(pos('a', 'pending'))).toBeNull()
  expect(record(pos('b'))).toBeNull() // restored position
  expect(record(pos('c'))).toEqual({ cfi: 'c', percent: 0.5 })
})

test('pending positions after the restore are recorded', () => {
  const record = positionRecorder()
  record(pos('a'))
  expect(record(pos('b', 'pending'))).toEqual({ cfi: 'b', percent: 0.5 })
})

test('the same position is not recorded twice', () => {
  const record = positionRecorder()
  record(pos('a'))
  record(pos('b'))
  expect(record(pos('b'))).toBeNull()
})
