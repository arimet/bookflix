// The browser's own zoom: a pinch on a book read by scrolling down, where prose-reader does not zoom.
export const isPageZoomed = () => (window.visualViewport?.scale ?? 1) > 1.01

// No script can set the browser's zoom: a viewport that forbids zooming brings it back to 1 on iPhone, then zooming
// is allowed again. (Chrome keeps its zoom.)
export function resetPageZoom() {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
  if (!meta) return
  const content = meta.content
  meta.content = `${content}, maximum-scale=1`
  setTimeout(() => {
    meta.content = content
  }, RESTORE_DELAY)
}
const RESTORE_DELAY = 300

type Tap = { time: number; x: number; y: number }
const DOUBLE_TAP_DELAY = 300
const DOUBLE_TAP_DISTANCE = 40

// A second tap soon after the first, close to it.
export const isDoubleTap = (previous: Tap | undefined, tap: Tap) =>
  !!previous && tap.time - previous.time < DOUBLE_TAP_DELAY && Math.hypot(tap.x - previous.x, tap.y - previous.y) < DOUBLE_TAP_DISTANCE
