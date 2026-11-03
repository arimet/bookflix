import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ChakraProvider } from '@chakra-ui/react'
import { MotionConfig } from 'motion/react'
import App from './App.tsx'
import { system } from './theme'
import { registerSW } from 'virtual:pwa-register'
import { updateReady } from './update'

registerSW({ immediate: true, onNeedReload: updateReady })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChakraProvider value={system}>
      {/* "Reduce motion" in the system settings turns the transforms off, fades stay. */}
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </ChakraProvider>
  </StrictMode>,
)
