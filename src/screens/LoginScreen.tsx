import { Box, Button, chakra, Input, Stack, Text } from '@chakra-ui/react'
import { Logo } from '../components/Logo'
import { useState } from 'react'
import type { DropboxApp } from '../config'
import { completeLogin, OFFLINE, restartConnection, startConnection } from '../dropbox/loginChain'

// An installed iOS web app may not get the OAuth redirect back, so it also offers the copy-paste code flow.
const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

type Props = { connected: Record<DropboxApp, boolean>; error: string | null; onDone: () => void; onError: (e: unknown) => void }

export function LoginScreen({ connected, error, onDone, onError }: Props) {
  const [codeFor, setCodeFor] = useState<DropboxApp | null>(null)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const halfway = connected.library && !connected.sync
  const shown = codeError ?? error

  // Code mode: Safari blocks a window opened outside a click, so the second app waits for the "2/2" button.
  const startCode = () => {
    setCodeError(null)
    startConnection('code').then(() => setCodeFor(connected.library ? 'sync' : 'library'), onError)
  }
  // The redirect leaves the page; in code mode the screen goes back to step 1/2.
  const restart = () => {
    setCodeError(null)
    if (!standalone) return restartConnection('redirect').catch(onError)
    restartConnection('code').then(() => {
      onDone()
      setCodeFor('library')
    }, onError)
  }

  const submitCode = (app: DropboxApp) =>
    completeLogin(app, code, 'code').then(
      // After the first code the library is connected and this screen turns to step 2/2.
      () => {
        setCode('')
        setCodeFor(null)
        onDone()
      },
      (e) => {
        setCodeError((e as Error).message)
        // Only a network failure can be retried with the same code: anything else needs a new authorization.
        if ((e as Error).message !== OFFLINE) setCodeFor(null)
      },
    )

  return (
    <Box minH="100dvh" display="grid" placeItems="center" p="6">
      <Stack gap="6" maxW="sm" w="full" textAlign="center">
        <Logo fontSize="5xl" />
        <Text color="muted">Tes livres et mangas, depuis ton Dropbox.</Text>
        <Stack gap="3" p="5" rounded="md" bg="panel">
          <Text fontWeight="semibold">{halfway ? 'Il reste une étape : la synchro.' : 'Connecte ton Dropbox'}</Text>
          <Text fontSize="sm" color="muted">
            {halfway
              ? 'Dropbox doit encore autoriser Bookflix à ranger profils et progression dans un dossier à part.'
              : 'Dropbox va te demander deux autorisations : lire tes livres, sans jamais pouvoir les modifier, puis ranger profils et progression dans un dossier à part.'}
          </Text>
          {shown && <Text fontSize="sm" color="brand" role="alert">{shown}</Text>}
          {!codeFor && (
            <Button bg="brand" color="white" onClick={() => startConnection('redirect').catch(onError)}>
              {halfway ? 'Continuer' : 'Se connecter à Dropbox'}
            </Button>
          )}
          {standalone && !codeFor && (
            <Button variant="ghost" onClick={startCode}>
              {halfway ? 'Autoriser la synchro (2/2)' : 'Se connecter avec un code'}
            </Button>
          )}
          {halfway && !codeFor && (
            <chakra.button fontSize="xs" color="muted" textDecoration="underline" textUnderlineOffset="3px" _hover={{ color: 'white' }}
              onClick={restart}>
              Recommencer depuis le début
            </chakra.button>
          )}
          {codeFor && (
            <Stack as="form" gap="3" onSubmit={(e) => { e.preventDefault(); submitCode(codeFor) }}>
              <Text fontSize="sm">
                {codeFor === 'library' ? 'Autorisation 1/2' : 'Autorisation 2/2'} : accepte dans Dropbox, puis colle ici le code affiché.
              </Text>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code Dropbox" autoComplete="off" />
              <Button type="submit" disabled={!code.trim()}>Valider</Button>
            </Stack>
          )}
        </Stack>
        <chakra.a href="confidentialite.html" fontSize="xs" color="muted" _hover={{ color: 'white' }}>Confidentialité</chakra.a>
      </Stack>
    </Box>
  )
}
