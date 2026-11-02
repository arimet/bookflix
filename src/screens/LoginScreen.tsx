import { Box, Button, Input, Stack, Text } from '@chakra-ui/react'
import { Logo } from '../components/Logo'
import { useState } from 'react'
import { LIBRARY_NAME, type DropboxApp } from '../config'
import { finishLogin, startLogin } from '../dropbox/auth'

// An installed iOS web app may not get the OAuth redirect back, so it also offers the copy-paste code flow.
const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

const STEPS: { app: DropboxApp; title: string; detail: string }[] = [
  { app: 'library', title: '1. Ta bibliothèque', detail: `Lecture seule du dossier ${LIBRARY_NAME}.` },
  { app: 'sync', title: '2. La synchro', detail: 'Profils et progression, dans un dossier à part.' },
]

type Props = { connected: Record<DropboxApp, boolean>; onDone: (app: DropboxApp) => void; onError: (e: unknown) => void }

export function LoginScreen({ connected, onDone, onError }: Props) {
  const [codeFor, setCodeFor] = useState<DropboxApp | null>(null)
  const [code, setCode] = useState('')
  const next = STEPS.find((s) => !connected[s.app])

  return (
    <Box minH="100dvh" display="grid" placeItems="center" p="6">
      <Stack gap="6" maxW="sm" w="full" textAlign="center">
        <Logo fontSize="5xl" />
        <Text color="muted">Tes livres et mangas, depuis ton Dropbox.</Text>
        {STEPS.map((step) => (
          <Stack key={step.app} gap="2" p="5" rounded="md" bg="panel" opacity={step === next || connected[step.app] ? 1 : 0.5}>
            <Text fontWeight="semibold">{step.title} {connected[step.app] && '✓'}</Text>
            <Text fontSize="sm" color="muted">{step.detail}</Text>
            {step === next && (
              <>
                <Button bg="brand" color="white" onClick={() => startLogin(step.app, 'redirect').catch(onError)}>Se connecter à Dropbox</Button>
                {standalone && codeFor !== step.app && (
                  <Button variant="ghost" onClick={() => startLogin(step.app, 'code').then(() => setCodeFor(step.app), onError)}>
                    Se connecter avec un code
                  </Button>
                )}
                {codeFor === step.app && (
                  <Stack as="form" gap="3" onSubmit={(e) => {
                    e.preventDefault()
                    finishLogin(step.app, code, 'code').then(() => { setCode(''); setCodeFor(null); onDone(step.app) }, onError)
                  }}>
                    <Text fontSize="sm">Autorise Bookflix dans Dropbox, puis colle ici le code affiché.</Text>
                    <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code Dropbox" autoComplete="off" />
                    <Button type="submit" disabled={!code.trim()}>Valider</Button>
                  </Stack>
                )}
              </>
            )}
          </Stack>
        ))}
      </Stack>
    </Box>
  )
}
