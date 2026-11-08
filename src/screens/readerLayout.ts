import { useState } from 'react'

const LAYOUT_KEY = 'bookflix.readerLayout'

// The page sits in a centred column of `width` rem; at FULL_WIDTH it takes the whole screen.
// lineHeight 'publisher' keeps the book's own spacing.
type ReaderTheme = 'night' | 'sepia' | 'bright'
export type Layout = { width: number; lineHeight: number | 'publisher'; theme: ReaderTheme }
const DEFAULT_LAYOUT: Layout = { width: 52, lineHeight: 'publisher', theme: 'night' }
export const THEMES: { theme: ReaderTheme; label: string; bg: string }[] = [
  { theme: 'bright', label: 'Clair', bg: '#ffffff' },
  { theme: 'sepia', label: 'Sépia', bg: '#eaddc5' },
  { theme: 'night', label: 'Sombre', bg: '#191717' },
]
export const FULL_WIDTH = 100
export const columnWidth = (width: number) => (width >= FULL_WIDTH ? '100%' : `${width}rem`)
export const themeBg = (theme: ReaderTheme) => THEMES.find((t) => t.theme === theme)!.bg

// The reader's layout, the same for every book and kept on the device.
export function useLayout() {
  const [layout, setLayout] = useState<Layout>(() => ({ ...DEFAULT_LAYOUT, ...JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? '{}') }))
  const changeLayout = (changes: Partial<Layout>) =>
    setLayout((old) => {
      const next = { ...old, ...changes }
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(next))
      return next
    })
  return [layout, changeLayout] as const
}
