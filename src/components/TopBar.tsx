import { Box, Button, chakra, Flex, HStack, IconButton, Input, Menu } from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import type { Profile } from '../sync/profiles'
import { Avatar } from './Avatar'
import { Logo } from './Logo'

export type Tab = 'home' | 'comics' | 'books' | 'search' | 'history' | 'requests'
const TABS: { tab: Tab; label: string; href: string }[] = [
  { tab: 'home', label: 'Accueil', href: '#/' },
  { tab: 'comics', label: 'BD & mangas', href: '#/bd' },
  { tab: 'books', label: 'Livres', href: '#/livres' },
  { tab: 'requests', label: 'Demandes', href: '#/demandes' },
]

export type ProfileAction = 'history' | 'reload' | 'folder' | 'avatar' | 'pin' | 'switch' | 'logout'
type Props = { active: Tab; profile: Profile | undefined; query: string; onQuery: (q: string) => void; onAction: (a: ProfileAction) => void }

export function TopBar({ active, profile, query, onQuery, onAction }: Props) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(scrollY > 10)
    addEventListener('scroll', onScroll, { passive: true })
    return () => removeEventListener('scroll', onScroll)
  }, [])

  return (
    <Flex as="header" position="fixed" top="0" insetX="0" zIndex="10" align="center" gap={{ base: 3, md: 8 }} wrap={{ base: 'wrap', md: 'nowrap' }}
      px={{ base: 4, md: 12 }} pt="max(0.75rem, env(safe-area-inset-top))" pb="3"
      bg={scrolled || active === 'search' ? '#141414' : 'linear-gradient(180deg, rgba(0,0,0,.7), transparent)'} transition="background .3s">
      <chakra.a href="#/" flex={{ base: '1', md: 'none' }}><Logo fontSize={{ base: 'xl', md: '3xl' }} /></chakra.a>
      {/* On a phone the tabs go on their own line under the logo, as in the Netflix app. */}
      <HStack as="nav" gap={{ base: 5, md: 5 }} fontSize="sm" whiteSpace="nowrap" order={{ base: 1, md: 0 }}
        w={{ base: 'full', md: 'auto' }} flex={{ md: '1' }}>
        {TABS.map((t) => (
          <chakra.a key={t.tab} href={t.href} color={active === t.tab ? 'white' : 'muted'} fontWeight={active === t.tab ? 'bold' : 'normal'}
            _hover={{ color: 'white' }} aria-current={active === t.tab ? 'page' : undefined}>
            {t.label}
          </chakra.a>
        ))}
      </HStack>
      {active === 'search' ? (
        <Input autoFocus size="sm" maxW="64" bg="black" borderColor="white" placeholder="Titre, série…" value={query}
          onChange={(e) => onQuery(e.target.value)} aria-label="Rechercher" />
      ) : (
        <IconButton asChild aria-label="Rechercher" variant="ghost" color="white" size="sm" fontSize="xl"><a href="#/recherche">🔍︎</a></IconButton>
      )}
      <Menu.Root onSelect={(e) => onAction(e.value as ProfileAction)} positioning={{ placement: 'bottom-end' }}>
        <Menu.Trigger asChild>
          <Button variant="ghost" size="sm" p="0" minW="8" aria-label={`Menu du profil ${profile?.name ?? ''}`}>
            {profile ? <Avatar profile={profile} size="2rem" rounded="sm" /> : <Box w="8" h="8" rounded="sm" bg="gray.600" />}
          </Button>
        </Menu.Trigger>
        <Menu.Positioner>
          <Menu.Content bg="rgba(0,0,0,.92)" color="white" borderColor="#333" minW="56">
            <Menu.Item value="history">Historique de lecture</Menu.Item>
            <Menu.Item value="reload">Recharger la bibliothèque</Menu.Item>
            <Menu.Item value="folder">Dossier des livres</Menu.Item>
            <Menu.Item value="avatar">Changer d'avatar</Menu.Item>
            <Menu.Item value="pin">Code PIN du profil</Menu.Item>
            <Menu.Separator borderColor="#333" />
            <Menu.Item value="switch">Changer de profil</Menu.Item>
            <Menu.Item value="logout" color="muted">Se déconnecter de Dropbox</Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Root>
    </Flex>
  )
}
