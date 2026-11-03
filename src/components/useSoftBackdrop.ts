import { useEffect, useState } from 'react'
import { boxBlur } from './boxBlur'

// A small, pre-blurred copy of the cover: stretched as a background it looks blurred without a CSS filter.
// iPhone Safari bleeds `filter: blur()` onto elements drawn over it (the top bar came out blurred).
export function useSoftBackdrop(url: string | null) {
  const [soft, setSoft] = useState<string | null>(null)
  const [glow, setGlow] = useState<string | null>(null)
  useEffect(() => {
    if (!url) return
    let alive = true
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 48
      canvas.height = Math.max(1, Math.round((48 * img.naturalHeight) / img.naturalWidth))
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
      if (alive) setGlow(vividColor(pixels.data))
      for (let i = 0; i < 3; i++) boxBlur(pixels.data, canvas.width, canvas.height, 2) // three box passes ≈ a gaussian
      ctx.putImageData(pixels, 0, 0)
      if (alive) setSoft(canvas.toDataURL('image/jpeg', 0.7))
    }
    img.src = url
    return () => {
      alive = false
    }
  }, [url])
  return { soft, glow }
}

// The cover's average colour weighted by saturation: the orange of Naruto rather than the grey of its paper.
export function vividColor(data: Uint8ClampedArray) {
  let r = 0, g = 0, b = 0, total = 0
  for (let i = 0; i < data.length; i += 4) {
    const max = Math.max(data[i], data[i + 1], data[i + 2])
    const weight = (max - Math.min(data[i], data[i + 1], data[i + 2])) ** 2
    r += data[i] * weight
    g += data[i + 1] * weight
    b += data[i + 2] * weight
    total += weight
  }
  return total ? `rgb(${Math.round(r / total)} ${Math.round(g / total)} ${Math.round(b / total)})` : null
}
