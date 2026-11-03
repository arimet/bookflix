import { Box, chakra, SimpleGrid, Text, type BoxProps } from '@chakra-ui/react'
import type { Profile } from '../sync/profiles'
import { AVATARS, findAvatar, type AvatarDef } from './avatars'

function Art({ avatar, size }: { avatar: AvatarDef; size: string }) {
  if ('svg' in avatar) return <svg viewBox="0 0 100 100" width="100%" height="100%" role="img" aria-label={avatar.label} dangerouslySetInnerHTML={{ __html: avatar.svg }} />
  return <Text as="span" fontSize={`calc(${size} * 0.6)`} lineHeight="1" role="img" aria-label={avatar.label}>{avatar.emoji}</Text>
}

// The profile picture: its avatar, or its initial on its colour for profiles made before avatars.
export function Avatar({ profile, size, ...box }: { profile: Pick<Profile, 'name' | 'color' | 'avatar'>; size: string } & BoxProps) {
  const avatar = findAvatar(profile.avatar)
  return (
    <Box w={size} h={size} rounded="md" overflow="hidden" bg={avatar?.color ?? profile.color} color="white" display="grid" placeItems="center"
      fontWeight="bold" fontSize={`calc(${size} * 0.5)`} flexShrink={0} {...box}>
      {avatar ? <Art avatar={avatar} size={size} /> : profile.name[0]?.toUpperCase()}
    </Box>
  )
}

export function AvatarPicker({ value, onChange }: { value: string | undefined; onChange: (a: AvatarDef) => void }) {
  return (
    <SimpleGrid columns={{ base: 4, sm: 8 }} gap="2" justifyItems="center" role="radiogroup" aria-label="Avatar">
      {AVATARS.map((a) => (
        <chakra.button key={a.id} type="button" role="radio" aria-checked={value === a.id} aria-label={a.label} onClick={() => onChange(a)}
          rounded="md" outline={value === a.id ? '3px solid white' : '3px solid transparent'} outlineOffset="1px">
          <Avatar profile={{ name: '', color: a.color, avatar: a.id }} size="3.25rem" />
        </chakra.button>
      ))}
    </SimpleGrid>
  )
}
