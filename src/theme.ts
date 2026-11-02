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
      // Netflix's loader: a red ring whose tail fades out, turning (Loader, and prose-reader's page loading).
      '.bf-loader, .prose-reader-enhancer-loading-container::before': {
        content: '""', display: 'block', w: '14', h: '14', rounded: 'full',
        bg: `conic-gradient(from 90deg, transparent 10%, ${RED})`,
        mask: 'radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px))',
        animation: 'spin 0.9s linear infinite',
      },
      // prose-reader shows "prose / loading <file name>" while a page loads: only the ring is kept.
      '.prose-reader-enhancer-loading-logo, .prose-reader-enhancer-loading-details': { display: 'none' },
      // Placeholders while the library loads (Skeleton rows).
      '.bf-shimmer': {
        bg: 'linear-gradient(100deg, #222 30%, #2e2e2e 50%, #222 70%)', bgSize: '300% 100%', animation: 'shimmer 1.4s ease-in-out infinite',
      },
    },
    theme: {
      // A cut title slides to its end and back (Marquee).
      keyframes: {
        shimmer: { from: { backgroundPosition: '100% 0' }, to: { backgroundPosition: '0 0' } },
        marquee: { '0%, 15%': { transform: 'translateX(0)' }, '85%, 100%': { transform: 'translateX(var(--shift))' } },
      },
      tokens: { colors: { brand: { value: RED } } },
      semanticTokens: { colors: { panel: { value: '#181818' }, muted: { value: '#b3b3b3' } } },
    },
  }),
)
