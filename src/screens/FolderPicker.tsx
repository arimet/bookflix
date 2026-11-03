import { Box, Button, chakra, Flex, Stack, Text } from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import { LuChevronRight, LuFolder } from 'react-icons/lu'
import { Loader } from '../components/Loader'
import { Logo } from '../components/Logo'
import { isTeamAccount, listFolders, type DbxFolder } from '../dropbox/api'

type Props = { initial: string; message?: string; onPick: (root: string) => void; onCancel?: () => void; onError: (e: unknown) => void }

// "Où sont tes livres ?": walk the Dropbox folders and pick the one holding the books. Read-only.
export function FolderPicker({ initial, message, onPick, onCancel, onError }: Props) {
  const [path, setPath] = useState(initial)
  const [folders, setFolders] = useState<DbxFolder[] | null>(null)
  const [team, setTeam] = useState(false)

  useEffect(() => {
    isTeamAccount().then(setTeam, () => {}) // only adds a line of explanation
  }, [])

  useEffect(() => {
    let alive = true
    setFolders(null)
    listFolders(path).then((f) => alive && setFolders(f), (e) => {
      // The folder to start from is gone: start from the top instead.
      if (alive && path) setPath('')
      else onError(e)
    })
    return () => {
      alive = false
    }
  }, [path, onError])

  const segments = path.split('/').filter(Boolean)
  const crumbs = [{ name: 'Dropbox', path: '' }, ...segments.map((name, i) => ({ name, path: '/' + segments.slice(0, i + 1).join('/') }))]

  return (
    <Box minH="100dvh" display="grid" placeItems="center" p="6" pt="max(1.5rem, env(safe-area-inset-top))">
      <Stack gap="5" maxW="md" w="full">
        <Logo fontSize="3xl" textAlign="center" />
        <Stack gap="1" textAlign="center">
          <Text fontSize="xl" fontWeight="bold">Où sont tes livres ?</Text>
          <Text fontSize="sm" color="muted">Choisis le dossier de ton Dropbox qui contient tes EPUB, CBZ, CBR ou PDF.</Text>
        </Stack>
        {message && <Text fontSize="sm" color="brand" textAlign="center" role="alert">{message}</Text>}
        <Stack gap="0" rounded="md" bg="panel" overflow="hidden">
          <Flex as="nav" aria-label="Dossier courant" wrap="wrap" align="center" gap="1" px="4" py="3" borderBottom="1px solid #2e2e2e" fontSize="sm">
            {crumbs.map((c, i) => (
              <Flex key={c.path} align="center" gap="1" minW="0">
                {i > 0 && <LuChevronRight color="#777" />}
                {i === crumbs.length - 1 ? (
                  <Text fontWeight="semibold" truncate>{c.name}</Text>
                ) : (
                  <chakra.button color="muted" _hover={{ color: 'white' }} onClick={() => setPath(c.path)} truncate>{c.name}</chakra.button>
                )}
              </Flex>
            ))}
          </Flex>
          <Box maxH="50dvh" overflowY="auto">
            {folders === null ? (
              <Box py="8" display="grid" placeItems="center"><Loader small /></Box>
            ) : folders.length === 0 ? (
              <Text px="4" py="6" fontSize="sm" color="muted" textAlign="center">Aucun sous-dossier ici.</Text>
            ) : (
              folders.map((f) => (
                <chakra.button key={f.path} display="flex" alignItems="center" gap="3" w="full" px="4" py="3" textAlign="left"
                  borderTop="1px solid #242424" _first={{ borderTop: 'none' }} _hover={{ bg: '#222' }} onClick={() => setPath(f.path)}>
                  <LuFolder color="#b3b3b3" />
                  <Text flex="1" truncate>{f.name}</Text>
                  <LuChevronRight color="#777" />
                </chakra.button>
              ))
            )}
          </Box>
        </Stack>
        {team && (
          <Text fontSize="xs" color="muted" textAlign="center">
            Les dossiers d'équipe Dropbox Business ne sont pas pris en charge : seuls tes dossiers personnels apparaissent.
          </Text>
        )}
        <Stack gap="2">
          <Button bg="brand" color="white" onClick={() => onPick(path)}>
            Choisir {segments.length ? `« ${segments.at(-1)} »` : 'tout mon Dropbox'}
          </Button>
          {onCancel && <Button variant="ghost" color="muted" onClick={onCancel}>Annuler</Button>}
        </Stack>
      </Stack>
    </Box>
  )
}
