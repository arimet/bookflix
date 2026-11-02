import { Button, Stack } from '@chakra-ui/react'
import { useState } from 'react'
import { updateProfile, type Profile } from '../sync/profiles'
import { AvatarPicker } from './Avatar'
import { findAvatar } from './avatars'
import { Shell } from './PinDialogs'

export function AvatarDialog({ profile, onDone, onClose, onError }: { profile: Profile; onDone: () => void; onClose: () => void; onError: (e: unknown) => void }) {
  const [avatar, setAvatar] = useState(findAvatar(profile.avatar))
  const save = async () => {
    if (!avatar) return
    try {
      await updateProfile(profile.id, { avatar: avatar.id, color: avatar.color })
      onDone()
    } catch (e) {
      onError(e)
    }
  }
  return (
    <Shell title={`Avatar de ${profile.name}`} onClose={onClose} size="md">
      <Stack gap="4">
        <AvatarPicker value={avatar?.id} onChange={setAvatar} />
        <Button bg="brand" color="white" disabled={!avatar} onClick={save}>Enregistrer</Button>
      </Stack>
    </Shell>
  )
}
