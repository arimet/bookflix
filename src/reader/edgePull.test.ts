import { describe, expect, it } from 'vitest'
import { edgePullSide } from './createAppReader'

// A 400 px wide screen zoomed ×1.5: the zoom's offset goes from 0 (left edge) to -200 (right edge).
const minX = -200
const width = 400

describe('edgePullSide', () => {
  it('turns left when pulling right well past the left edge', () => {
    expect(edgePullSide({ startX: 0, endX: 0, deltaX: 150 }, minX, width)).toBe('left')
  })

  it('turns right when pulling left well past the right edge', () => {
    expect(edgePullSide({ startX: -200, endX: -200, deltaX: -150 }, minX, width)).toBe('right')
  })

  it('counts only the pull left over once the page has reached its edge', () => {
    expect(edgePullSide({ startX: -150, endX: 0, deltaX: 200 }, minX, width)).toBe(null)
    expect(edgePullSide({ startX: -150, endX: 0, deltaX: 260 }, minX, width)).toBe('left')
  })

  it('leaves a pan that stays inside the page alone', () => {
    expect(edgePullSide({ startX: -50, endX: -150, deltaX: -100 }, minX, width)).toBe(null)
  })

  it('leaves a short tug at the edge alone', () => {
    expect(edgePullSide({ startX: 0, endX: 0, deltaX: 60 }, minX, width)).toBe(null)
  })
})
