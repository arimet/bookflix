import { useEffect, useRef, type RefObject } from 'react'
import { clampView, DOUBLE_TAP_SCALE, pinchScale, restingScale, settle, zoomAround, zoomFrame, type View } from '../reader/stripZoom'

const ZOOM_DURATION = 350

type Point = { x: number; y: number }

// The comic strip's own zoom, as on iPhone: a pinch zooms around the point between the fingers, which then follow
// it; a double tap zooms in on the point tapped, or back out. The strip is scaled, and the box scrolls over it, so
// moving around a zoomed page is the browser's scroll, with its momentum and its bounce. The browser's own zoom
// cannot be animated nor set: the box keeps it off (touch-action: pan-x pan-y).
// scale: the zoom now; toggleZoom(at): the double tap, at a point of the box.
export function useStripZoom(box: RefObject<HTMLDivElement | null>, strip: RefObject<HTMLDivElement | null>) {
  const scale = useRef(1)
  const zoomTo = useRef<(to: number, at: Point) => void>(() => {})

  useEffect(() => {
    const element = box.current
    const content = strip.current
    if (!element || !content) return
    let animation = 0

    const viewNow = (): View => ({ scale: scale.current, x: element.scrollLeft / scale.current, y: element.scrollTop / scale.current })
    const show = (view: View) => {
      content.style.transform = view.scale === 1 ? '' : `scale(${view.scale})`
      scale.current = view.scale
      element.scrollLeft = view.x * view.scale
      element.scrollTop = view.y * view.scale
    }
    // Eases from the view now to `to` around `at`, ending within the strip.
    zoomTo.current = (to, at) => {
      cancelAnimationFrame(animation)
      const start = viewNow()
      const target = clampView(zoomAround(start, to, at), { width: content.offsetWidth, height: content.offsetHeight },
        { width: element.clientWidth, height: element.clientHeight })
      const began = performance.now()
      const step = (now: number) => {
        const t = Math.min(1, (now - began) / ZOOM_DURATION)
        show(zoomFrame(start, to, at, target, settle(t)))
        if (t < 1) animation = requestAnimationFrame(step)
      }
      animation = requestAnimationFrame(step)
    }

    let pinch: { start: View; distance: number; at: Point } | undefined
    let last: Point = { x: 0, y: 0 }
    const fingers = (touches: TouchList) => {
      const rect = element.getBoundingClientRect()
      const [a, b] = [touches[0], touches[1]]
      return { x: (a.clientX + b.clientX) / 2 - rect.left, y: (a.clientY + b.clientY) / 2 - rect.top, distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) }
    }
    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return
      cancelAnimationFrame(animation)
      const { distance, ...at } = fingers(event.touches)
      pinch = { start: viewNow(), distance, at }
      last = at
    }
    const onMove = (event: TouchEvent) => {
      if (!pinch || event.touches.length < 2) return
      if (event.cancelable) event.preventDefault() // the fingers zoom, the box does not scroll under them
      const { distance, ...at } = fingers(event.touches)
      const s = pinchScale(pinch.start.scale * (distance / pinch.distance))
      const held = zoomAround(pinch.start, s, pinch.at) // the point first between the fingers, kept under them
      show({ scale: s, x: held.x - (at.x - pinch.at.x) / s, y: held.y - (at.y - pinch.at.y) / s })
      last = at
    }
    const onEnd = (event: TouchEvent) => {
      if (!pinch || event.touches.length >= 2) return
      pinch = undefined
      zoomTo.current(restingScale(scale.current), last) // springs back within the limits and the edges
    }
    element.addEventListener('touchstart', onStart, { passive: true })
    element.addEventListener('touchmove', onMove, { passive: false })
    element.addEventListener('touchend', onEnd)
    element.addEventListener('touchcancel', onEnd)
    return () => {
      element.removeEventListener('touchstart', onStart)
      element.removeEventListener('touchmove', onMove)
      element.removeEventListener('touchend', onEnd)
      element.removeEventListener('touchcancel', onEnd)
      cancelAnimationFrame(animation)
      zoomTo.current = () => {}
    }
  }, [box, strip])

  const toggleZoom = (at: Point) => zoomTo.current(scale.current > 1.01 ? 1 : DOUBLE_TAP_SCALE, at)
  return { scale, toggleZoom }
}
