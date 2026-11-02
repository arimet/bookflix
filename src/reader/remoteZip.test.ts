import { Uint8ArrayWriter, type FileEntry } from '@zip.js/zip.js'
import JSZip from 'jszip'
import { expect, test } from 'vitest'
import { blockReader, openRemoteZip } from './remoteZip'

test('a remote zip is read by ranges, not downloaded whole', async () => {
  const zip = new JSZip()
  zip.file('001.jpg', new Uint8Array(2_000_000).fill(7), { compression: 'STORE' })
  zip.file('002.jpg', new Uint8Array([1, 2, 3]), { compression: 'STORE' })
  const bytes = await zip.generateAsync({ type: 'uint8array' })
  let fetched = 0
  const reader = openRemoteZip(bytes.length, async (start, length) => {
    fetched += length
    return bytes.slice(start, start + length)
  })

  const entries = await reader.getEntries()
  const small = entries.find((e) => e.filename === '002.jpg') as FileEntry
  const data = await small.getData(new Uint8ArrayWriter())

  expect(entries.map((e) => e.filename).sort()).toEqual(['001.jpg', '002.jpg'])
  expect([...data]).toEqual([1, 2, 3])
  expect(fetched).toBeLessThan(bytes.length / 10)
})

test('blockReader fetches whole blocks once and serves nearby reads from them', async () => {
  const bytes = Uint8Array.from({ length: 10_000 }, (_, i) => i % 251)
  const fetched: [number, number][] = []
  const read = blockReader(bytes.length, 1000, async (start, length) => {
    fetched.push([start, length])
    return bytes.slice(start, start + length)
  })

  expect([...(await read(10, 30))]).toEqual([...bytes.slice(10, 40)]) // a zip entry header
  expect([...(await read(40, 500))]).toEqual([...bytes.slice(40, 540)]) // its data, same block
  expect(fetched).toEqual([[0, 1000]])

  expect([...(await read(900, 1200))]).toEqual([...bytes.slice(900, 2100)]) // spans blocks 0-2: only 1-2 fetched, in one request
  expect(fetched).toEqual([[0, 1000], [1000, 2000]])

  expect([...(await read(9990, 10))]).toEqual([...bytes.slice(9990, 10_000)]) // last, short block
  expect(fetched.at(-1)).toEqual([9000, 1000])
})

test('blockReader shares one request between concurrent reads of the same block', async () => {
  const bytes = new Uint8Array(4000)
  let calls = 0
  const read = blockReader(bytes.length, 1000, async (start, length) => {
    calls++
    return bytes.slice(start, start + length)
  })
  await Promise.all([read(0, 10), read(500, 10), read(990, 10)])
  expect(calls).toBe(1)
})
