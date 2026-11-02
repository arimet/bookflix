import { expect, test } from 'vitest'
import { pickCoverEntry, pickEpubCover } from './extract'

test('pickCoverEntry returns the first image by natural order', () => {
  expect(pickCoverEntry(['p10.jpg', 'p2.jpg', 'ComicInfo.xml'])).toBe('p2.jpg')
  expect(pickCoverEntry(['__MACOSX/._p1.jpg', 'Vol/p1.PNG'])).toBe('Vol/p1.PNG')
  expect(pickCoverEntry(['a.txt'])).toBeNull()
})

test('pickEpubCover uses the cover-image property', () => {
  const opf = `<package><manifest>
    <item id="a" href="images/a.jpg" media-type="image/jpeg"/>
    <item id="c" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>
  </manifest></package>`
  expect(pickEpubCover(opf)).toBe('images/cover.jpg')
})

test('pickEpubCover falls back to meta name="cover"', () => {
  const opf = `<package><metadata><meta name="cover" content="c"/></metadata><manifest>
    <item id="a" href="a.jpg" media-type="image/jpeg"/>
    <item id="c" href="c.jpg" media-type="image/jpeg"/>
  </manifest></package>`
  expect(pickEpubCover(opf)).toBe('c.jpg')
})

test('pickEpubCover falls back to the first image', () => {
  const opf = `<package><manifest>
    <item id="t" href="t.xhtml" media-type="application/xhtml+xml"/>
    <item id="a" href="a.png" media-type="image/png"/>
  </manifest></package>`
  expect(pickEpubCover(opf)).toBe('a.png')
})
