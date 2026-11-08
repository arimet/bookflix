// A view of the comic strip: its zoom, and the point of the strip (in unzoomed pixels) at the top left of its box.
export type View = { scale: number; x: number; y: number }
type Point = { x: number; y: number }
type Size = { width: number; height: number }

export const MAX_SCALE = 4
export const DOUBLE_TAP_SCALE = 2.5

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

// The view at `scale` that keeps the strip point under `at` (a point of the box) where it is.
export function zoomAround(view: View, scale: number, at: Point): View {
  const x = view.x + at.x / view.scale
  const y = view.y + at.y / view.scale
  return { scale, x: x - at.x / scale, y: y - at.y / scale }
}

// The view moved back within the strip: no blank past its edges.
export const clampView = (view: View, strip: Size, box: Size): View => ({
  scale: view.scale,
  x: clamp(view.x, 0, Math.max(0, strip.width - box.width / view.scale)),
  y: clamp(view.y, 0, Math.max(0, strip.height - box.height / view.scale)),
})

// The scale a pinch may reach under the fingers, a little past the limits it then springs back to.
export const pinchScale = (scale: number) => clamp(scale, 0.75, MAX_SCALE * 1.25)

// The scale a zoom rests at once the fingers are off.
export const restingScale = (scale: number) => clamp(scale, 1, MAX_SCALE)

// Like iPhone's: fast at first, settling softly.
export const settle = (t: number) => 1 - (1 - t) ** 3

// The frame at `progress` (0 to 1, already eased) of a zoom from `start` to `scale` around `at`, ending at `target`
// (that zoom, moved back within the strip): the point under `at` stays put, the move back comes in bit by bit.
export function zoomFrame(start: View, scale: number, at: Point, target: View, progress: number): View {
  const free = zoomAround(start, scale, at)
  const now = zoomAround(start, start.scale + (scale - start.scale) * progress, at)
  return { scale: now.scale, x: now.x + (target.x - free.x) * progress, y: now.y + (target.y - free.y) * progress }
}
