import { useEffect, useState } from 'react'
import { boxBlur } from './boxBlur'

// A small, pre-blurred copy of the cover: stretched as a background it looks blurred without a CSS filter.
// iPhone Safari bleeds `filter: blur()` onto elements drawn over it (the top bar came out blurred).
export function useSoftBackdrop(url: string | null) {
  const [soft, setSoft] = useState<string | null>(null)
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
      for (let i = 0; i < 3; i++) boxBlur(pixels.data, canvas.width, canvas.height, 2) // three box passes ≈ a gaussian
      ctx.putImageData(pixels, 0, 0)
      if (alive) setSoft(canvas.toDataURL('image/jpeg', 0.7))
    }
    img.src = url
    return () => {
      alive = false
    }
  }, [url])
  return soft
}
