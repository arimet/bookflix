import JSZip from 'jszip'
import { expect, test } from 'vitest'
import { openBook } from './openBook'

const cbz = async () => {
  const zip = new JSZip()
  zip.file('001.jpg', new Uint8Array([0xff, 0xd8, 0xff]))
  zip.file('002.jpg', new Uint8Array([0xff, 0xd8, 0xff]))
  return zip.generateAsync({ type: 'blob' })
}

test('openBook cbz uses chosen direction', async () => {
  const book = await openBook(await cbz(), 't.cbz', 'cbz', 'ltr')
  expect(book.manifest.readingDirection).toBe('ltr')
  expect(book.manifest.spineItems).toHaveLength(2)
  book.close()
})

test('openBook cbz right to left when asked', async () => {
  const book = await openBook(await cbz(), 't.cbz', 'cbz', 'rtl')
  expect(book.manifest.readingDirection).toBe('rtl')
  book.close()
})

test('openBook serves resources from the archive', async () => {
  const book = await openBook(await cbz(), 't.cbz', 'cbz', 'rtl')
  const res = await new Promise<Response>((resolve) => book.getResource(book.manifest.spineItems[0]).subscribe(resolve))
  expect(res.status).toBe(200)
  book.close()
})

test('openBook rejects corrupted archive', async () => {
  await expect(openBook(new Blob(['not a zip']), 'x.cbz', 'cbz', 'rtl')).rejects.toThrow()
})
