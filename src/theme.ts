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
    },
    theme: {
      tokens: { colors: { brand: { value: RED } } },
      semanticTokens: { colors: { panel: { value: '#181818' }, muted: { value: '#b3b3b3' } } },
    },
  }),
)
