// The browser's own zoom: a pinch on a book read by scrolling down, where prose-reader does not zoom.
export const isPageZoomed = () => (window.visualViewport?.scale ?? 1) > 1.01

type ZoomedView = { scale: number; offsetLeft: number; offsetTop: number }

// The transform that makes a surface at `origin` (its top left, unzoomed) look as it did through a zoomed view: a
// point p of it was on screen at (p - offset) * scale. With the transform origin at its top left.
export function zoomedLook({ scale, offsetLeft, offsetTop }: ZoomedView, origin: { x: number; y: number }) {
  const x = (scale - 1) * origin.x - scale * offsetLeft
  const y = (scale - 1) * origin.y - scale * offsetTop
  return `translate(${x}px, ${y}px) scale(${scale})`
}

// No script can set the browser's zoom: a viewport that forbids zooming brings it back to 1 on iPhone, then zooming
// is allowed again. (Chrome keeps its zoom.) The jump back is hidden as on iPhone: `surface` (the reader, covering
// the screen) is shown as it looked zoomed in, then eases back to its place.
export function resetPageZoom(surface?: HTMLElement | null) {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
  const view = window.visualViewport
  if (!meta || !view) return
  const content = meta.content
  const style = surface?.style
  if (style && surface) {
    const { left, top } = surface.getBoundingClientRect()
    Object.assign(style, { transition: 'none', transformOrigin: '0 0', transform: zoomedLook(view, { x: left, y: top }) })
  }
  meta.content = `${content}, maximum-scale=1`
  setTimeout(() => {
    meta.content = content
  }, RESTORE_DELAY)
  if (!style) return
  const settle = () => {
    view.removeEventListener('resize', settle)
    clearTimeout(fallback)
    // The browser kept its zoom (Chrome): the surface goes straight back.
    if (isPageZoomed()) return Object.assign(style, { transform: '', transformOrigin: '' })
    requestAnimationFrame(() => {
      Object.assign(style, { transition: `transform ${UNZOOM_DURATION}ms cubic-bezier(.2, .8, .2, 1)`, transform: '' })
      setTimeout(() => Object.assign(style, { transition: '', transformOrigin: '' }), UNZOOM_DURATION)
    })
  }
  view.addEventListener('resize', settle)
  const fallback = setTimeout(settle, SETTLE_TIMEOUT)
}
const RESTORE_DELAY = 300
const UNZOOM_DURATION = 300
const SETTLE_TIMEOUT = 200

type Tap = { time: number; x: number; y: number }
const DOUBLE_TAP_DELAY = 300
const DOUBLE_TAP_DISTANCE = 40

// A second tap soon after the first, close to it.
export const isDoubleTap = (previous: Tap | undefined, tap: Tap) =>
  !!previous && tap.time - previous.time < DOUBLE_TAP_DELAY && Math.hypot(tap.x - previous.x, tap.y - previous.y) < DOUBLE_TAP_DISTANCE
