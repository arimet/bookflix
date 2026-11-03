import { describe, expect, it } from 'vitest'
import { tapSide } from './createAppReader'

describe('tapSide', () => {
  it('turns on the outer thirds and leaves the middle to the menu', () => {
    expect(tapSide(100, 900)).toBe('left')
    expect(tapSide(450, 900)).toBe(null)
    expect(tapSide(800, 900)).toBe('right')
  })
})
