import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ChakraProvider } from '@chakra-ui/react'
import App from './App.tsx'
import { system } from './theme'
import { registerSW } from 'virtual:pwa-register'
import { updateReady } from './update'

registerSW({ immediate: true, onNeedReload: updateReady })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChakraProvider value={system}>
      <App />
    </ChakraProvider>
  </StrictMode>,
)
