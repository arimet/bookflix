import { Box, Button, Heading, Input, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { FullLoader } from '../components/Loader'
import { useEffect, useState } from 'react'
import { Avatar, AvatarPicker } from '../components/Avatar'
import { AVATARS } from '../components/avatars'
import { Logo } from '../components/Logo'
import { PinPrompt } from '../components/PinDialogs'
import { addProfile, loadProfiles, setProfilePin, type Profile } from '../sync/profiles'

function Tile({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Stack as="button" onClick={onClick} align="center" gap="3" cursor="pointer" className="group">
      <Box rounded="md" outline="3px solid transparent" transition="outline-color .15s" _groupHover={{ outlineColor: 'white' }}>
        {children}
      </Box>
      <Text color="muted" fontSize={{ base: 'md', md: 'lg' }} _groupHover={{ color: 'white' }}>{label}</Text>
    </Stack>
  )
}

export function ProfilesScreen({ onPick, onError }: { onPick: (p: Profile) => void; onError: (e: unknown) => void }) {
  const [profiles, setProfiles] = useState<Profile[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState(AVATARS[0])
  const [pin, setPin] = useState('')
  const [locked, setLocked] = useState<Profile | null>(null)

  const create = async () => {
    try {
      const profile = await addProfile(name, avatar.color, avatar.id)
      if (pin) await setProfilePin(profile.id, pin)
      onPick(profile)
    } catch (e) {
      onError(e)
    }
  }

  useEffect(() => {
    loadProfiles().then(setProfiles, onError)
  }, [onError])

  if (!profiles) return <FullLoader />

  return (
    <Box minH="100dvh" display="grid" placeItems="center" p="6">
      <Stack gap="8" align="center">
        <Logo position="fixed" top="calc(env(safe-area-inset-top) + 1.25rem)" left="6" />
        <Heading fontSize={{ base: '3xl', md: '5xl' }} fontWeight="medium">Qui lit ?</Heading>
        {adding ? (
          <Stack as="form" gap="4" w={{ base: 'full', sm: 'md' }} onSubmit={(e) => { e.preventDefault(); create() }}>
            <Stack direction="row" align="center" gap="4">
              <Avatar profile={{ name, color: avatar.color, avatar: avatar.id }} size="4.5rem" />
              <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Prénom" />
            </Stack>
            <AvatarPicker value={avatar.id} onChange={setAvatar} />
            <Input type="password" inputMode="numeric" autoComplete="off" maxLength={4} placeholder="Code PIN (optionnel, 4 chiffres)"
              value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} aria-label="Code PIN, optionnel" />
            <Button type="submit" bg="brand" color="white" disabled={!name.trim() || (pin.length > 0 && pin.length < 4)}>Créer</Button>
            <Button variant="ghost" onClick={() => setAdding(false)}>Annuler</Button>
          </Stack>
        ) : (
          <SimpleGrid columns={{ base: 2, md: 4 }} gap="6">
            {profiles.map((p) => (
              <Tile key={p.id} label={p.pinHash ? `${p.name} 🔒` : p.name} onClick={() => (p.pinHash ? setLocked(p) : onPick(p))}>
                <Avatar profile={p} size="clamp(6rem, 22vw, 9rem)" />
              </Tile>
            ))}
            <Tile label="Ajouter un profil" onClick={() => setAdding(true)}>
              <Box w="clamp(6rem, 22vw, 9rem)" h="clamp(6rem, 22vw, 9rem)" rounded="md" bg="#2a2a2a" display="grid" placeItems="center" fontSize="5xl" color="muted">+</Box>
            </Tile>
          </SimpleGrid>
        )}
      </Stack>
      {locked && <PinPrompt profile={locked} onOk={() => onPick(locked)} onClose={() => setLocked(null)} />}
    </Box>
  )
}
