import { Button, Flex, Stack, Text } from '@chakra-ui/react'
import { LuRefreshCw } from 'react-icons/lu'
import { Shell } from '../components/PinDialogs'
import type { BookSetting, Direction, Flow } from '../sync/books'
import { FULL_WIDTH, THEMES, type Layout } from './readerLayout'

type SettingsProps = {
  open: boolean
  onClose: () => void
  layout: Layout
  onLayout: (changes: Partial<Layout>) => void
  direction?: Direction
  flow?: { flow: Flow; scrollOnly: boolean }
  onBook: (changes: BookSetting) => void // reopens the book
  text?: boolean // a book with text: its line height can be set
  onReload: () => void // opens the book again where it is, for a page that did not show
}

export function ReaderSettings({ open, onClose, layout, onLayout, direction, flow, onBook, text = true, onReload }: SettingsProps) {
  return (
    <Shell title="Réglages" open={open} onClose={onClose} size="md">
      <Stack gap="2" mb="6">
        <Text fontWeight="semibold">Thème</Text>
        <Flex gap="2">
          {THEMES.map((t) => (
            <Button key={t.theme} flex="1" bg={t.bg} color={t.theme === 'night' ? 'white' : 'black'}
              outline={layout.theme === t.theme ? '2px solid #e50914' : 'none'} onClick={() => onLayout({ theme: t.theme })}>
              {t.label}
            </Button>
          ))}
        </Flex>
      </Stack>
      <Stack gap="2" mb="6">
        <Flex justify="space-between">
          <Text fontWeight="semibold">Largeur</Text>
          <Text color="fg.muted">{layout.width >= FULL_WIDTH ? 'Pleine' : `${layout.width} rem`}</Text>
        </Flex>
        <input type="range" min={28} max={FULL_WIDTH} step={2} value={layout.width} aria-label="Largeur"
          onChange={(e) => onLayout({ width: Number(e.target.value) })} />
      </Stack>
      {text && <Stack gap="2" mb="6">
        <Flex justify="space-between" align="center">
          <Text fontWeight="semibold">Hauteur de ligne</Text>
          <Text color="fg.muted">{layout.lineHeight === 'publisher' ? 'Celle du livre' : layout.lineHeight.toFixed(1)}</Text>
        </Flex>
        <input type="range" min={1} max={2.4} step={0.1} aria-label="Hauteur de ligne"
          value={layout.lineHeight === 'publisher' ? 1.5 : layout.lineHeight}
          onChange={(e) => onLayout({ lineHeight: Number(e.target.value) })} />
        <Button size="xs" variant="ghost" alignSelf="end" disabled={layout.lineHeight === 'publisher'}
          onClick={() => onLayout({ lineHeight: 'publisher' })}>
          Revenir à celle du livre
        </Button>
      </Stack>}
      <Stack gap="2" mb="6">
        <Text fontWeight="semibold">Défilement</Text>
        <Flex gap="2">
          <Button flex="1" variant={flow?.flow === 'pages' ? 'solid' : 'outline'} disabled={!flow || flow.scrollOnly}
            onClick={() => flow?.flow !== 'pages' && onBook({ flow: 'pages' })}>
            Page par page
          </Button>
          <Button flex="1" variant={flow?.flow === 'scroll' ? 'solid' : 'outline'} disabled={!flow}
            onClick={() => flow?.flow !== 'scroll' && onBook({ flow: 'scroll' })}>
            Vers le bas
          </Button>
        </Flex>
        {flow?.scrollOnly && <Text fontSize="sm" color="fg.muted">Ce livre se lit forcément en défilant.</Text>}
      </Stack>
      <Stack gap="2">
        <Text fontWeight="semibold">Sens de lecture</Text>
        <Button variant={direction === 'ltr' ? 'solid' : 'outline'} onClick={() => onBook({ direction: 'ltr' })}>
          Gauche → droite (livre)
        </Button>
        <Button variant={direction === 'rtl' ? 'solid' : 'outline'} onClick={() => onBook({ direction: 'rtl' })}>
          Droite → gauche (manga)
        </Button>
      </Stack>
      <Stack gap="2" mt="6">
        <Text fontWeight="semibold">Un souci d'affichage ?</Text>
        <Button variant="outline" onClick={onReload}><LuRefreshCw /> Recharger la page</Button>
      </Stack>
    </Shell>
  )
}
