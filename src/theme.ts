import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'

// Dark "cinema" look: near-black background, red accent. The app always runs in dark mode (class on <html>).
export const RED = '#e50914'

export const system = createSystem(
  defaultConfig,
  defineConfig({
    globalCss: {
      'html, body': { bg: '#141414', color: 'white', colorScheme: 'dark' },
      '*:focus-visible': { outline: `2px solid ${RED}`, outlineOffset: '2px' },
      // prose-reader's "Refit" only applies to two-page comic spreads; disabled, it is just a grey icon.
      'button[aria-label="Refit"]:disabled': { display: 'none' },
      // Netflix's loader: a red ring whose tail fades out, turning (Loader).
      '.bf-loader': {
        w: '14', h: '14', rounded: 'full',
        bg: `conic-gradient(from 90deg, transparent 10%, ${RED})`,
        mask: 'radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px))',
        animation: 'spin 0.9s linear infinite',
      },
      // prose-reader shows "prose / loading <file name>" on every page not loaded yet, which is most of the
      // book: the same ring instead, but only on the page on screen (markSpineItemOnScreen). A ring turning on
      // every chapter, or every page of a 700-page manga, made Safari on iPhone kill the reader. No mask here:
      // the ring's hole is the page colour painted over the gradient.
      '.prose-reader-enhancer-loading-logo, .prose-reader-enhancer-loading-details': { display: 'none' },
      '[data-on-screen][data-is-ready=false] .prose-reader-enhancer-loading-container::before': {
        content: '""', w: '14', h: '14', rounded: 'full',
        bg: `radial-gradient(farthest-side, var(--prose-reader-theme-background-color, #141414) calc(100% - 5px), transparent calc(100% - 4px)), conic-gradient(from 90deg, transparent 10%, ${RED})`,
        animation: 'spin 0.9s linear infinite',
      },
      // Placeholders while the library loads (Skeleton rows).
      '.bf-shimmer': {
        bg: 'linear-gradient(100deg, #222 30%, #2e2e2e 50%, #222 70%)', bgSize: '300% 100%', animation: 'shimmer 1.4s ease-in-out infinite',
      },
    },
    theme: {
      // A cut title slides to its end and back (Marquee).
      keyframes: {
        shimmer: { from: { backgroundPosition: '100% 0' }, to: { backgroundPosition: '0 0' } },
        rise: { from: { opacity: 0, transform: 'translateY(16px) scale(.98)' }, to: { opacity: 1, transform: 'none' } },
        marquee: { '0%, 15%': { transform: 'translateX(0)' }, '85%, 100%': { transform: 'translateX(var(--shift))' } },
      },
      tokens: { colors: { brand: { value: RED } } },
      semanticTokens: { colors: { panel: { value: '#181818' }, muted: { value: '#b3b3b3' } } },
    },
  }),
)
