import { firstValueFrom, of } from 'rxjs'
import { expect, test } from 'vitest'
import { flatLayout } from './createAppReader'

test('places every page after the previous one, even for far more pages than a phone stack holds', async () => {
  const items = Array.from({ length: 20_000 }, (_, i) => i)
  const spineLayout = {
    spineItemsManager: { items },
    layOutItem: (item: unknown, offset: { horizontalOffset: number; verticalOffset: number }) =>
      of({ item, endOffset: { horizontalOffset: offset.horizontalOffset + 10, verticalOffset: 0 } }),
    layOutItems: (_laidOut: unknown[]) => of<unknown[]>([]),
  }
  const reader = flatLayout((_options: object) => ({ spine: { spineLayout } }))({})
  const placed = (await firstValueFrom(reader.spine.spineLayout.layOutItems([]))) as { endOffset: { horizontalOffset: number } }[]
  expect(placed).toHaveLength(20_000)
  expect(placed[19_999].endOffset.horizontalOffset).toBe(200_000)
})
