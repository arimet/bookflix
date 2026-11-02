import { Badge, Box, Button, chakra, CloseButton, Dialog, Flex, Heading, Image, Stack, Text } from '@chakra-ui/react'
import { useRef, useState } from 'react'
import { isRead, resumeBook, type Series } from '../library/catalog'
import type { Book } from '../library/library'
import { cachedBookSettings, defaultDirection } from '../sync/books'
import type { ProgressMap } from '../sync/progress'
import { BookCover } from './BookCover'
import { BookMenu } from './BookMenu'
import { Marquee } from './Marquee'
import { useCoverUrl } from './useCoverUrl'
import { useSoftBackdrop } from './useSoftBackdrop'
import { readHref } from '../routes'

type Props = {
  series: Series
  progress: ProgressMap
  offline: Set<string>
  onToggleOffline: (book: Book) => Promise<void>
  onReset: (book: Book) => void
  onClose: () => void
}

function Episode({ book, index, progress, offline, onToggleOffline, onReset }: { book: Book; index: number } & Omit<Props, 'series' | 'onClose'>) {
  const [busy, setBusy] = useState(false)
  const percent = progress[book.id]?.percent ?? 0
  const state = isRead(book, progress) ? 'Lu' : percent > 0 ? `${Math.round(percent * 100)} %` : 'Pas commencé'
  return (
    <Flex gap="4" align="center" py="3" px="2" borderTop="1px solid #2e2e2e" rounded="sm" _hover={{ bg: '#2a2a2a' }}>
      <Text w="6" textAlign="center" fontSize="xl" color="muted" hideBelow="sm">{index + 1}</Text>
      <BookMenu title={book.title} onReset={percent > 0 ? () => onReset(book) : undefined}
        onRemoveOffline={offline.has(book.id) ? () => onToggleOffline(book) : undefined}>
        <chakra.a href={readHref(book)} display="flex" gap="4" alignItems="center" flex="1" minW="0">
          <Box w="14" flexShrink={0}><BookCover book={book} small percent={isRead(book, progress) ? undefined : percent} /></Box>
          <Stack gap="1" minW="0">
            <Marquee fontWeight="bold">{book.title}</Marquee>
            <Text fontSize="sm" color="muted">{state} · {book.format.toUpperCase()}</Text>
          </Stack>
        </chakra.a>
      </BookMenu>
      <Button size="sm" variant="ghost" color={offline.has(book.id) ? '#46d369' : 'muted'} loading={busy}
        aria-label={offline.has(book.id) ? `Retirer ${book.title} de l'appareil` : `Télécharger ${book.title}`}
        onClick={() => { setBusy(true); onToggleOffline(book).finally(() => setBusy(false)) }}>
        {offline.has(book.id) ? '✓' : '⤓'}
      </Button>
    </Flex>
  )
}

export function SeriesModal({ series, progress, offline, onToggleOffline, onReset, onClose }: Props) {
  const header = useRef<HTMLDivElement>(null)
  const next = resumeBook(series, progress)
  const cover = useCoverUrl(series.books[0], header)
  const backdrop = useSoftBackdrop(cover)
  const read = series.books.filter((b) => isRead(b, progress)).length
  const started = (progress[next.id]?.percent ?? 0) > 0
  const first = series.books[0]
  const direction = cachedBookSettings()[first.id]?.direction ?? defaultDirection(first.format)
  const [downloadingAll, setDownloadingAll] = useState(false)
  const missing = series.books.filter((b) => !offline.has(b.id))

  const downloadAll = async () => {
    setDownloadingAll(true)
    for (const book of missing) await onToggleOffline(book) // one at a time: books can be large
    setDownloadingAll(false)
  }

  return (
    <Dialog.Root open onOpenChange={(e) => !e.open && onClose()} size={{ base: 'full', md: 'lg' }} scrollBehavior="outside">
      <Dialog.Backdrop bg="rgba(0,0,0,.7)" backdropFilter="blur(4px)" />
      <Dialog.Positioner>
        <Dialog.Content bg="panel" color="white" overflow="hidden" rounded={{ base: 'none', md: 'lg' }} my={{ md: 8 }}
          pt={{ base: 'env(safe-area-inset-top)', md: 0 }}>
          <Box ref={header} position="relative" overflow="hidden" h={{ base: "56", md: "72" }}>
            {backdrop && <Box position="absolute" inset="0" bgImage={`linear-gradient(rgba(0,0,0,.4), rgba(0,0,0,.4)), url(${backdrop})`} bgSize="cover" bgPos="center" />}
            <Box position="absolute" inset="0" bg="linear-gradient(0deg, #181818 5%, transparent 70%)" />
            {cover && <Image src={cover} alt="" position="absolute" right="6" top="6" h="70%" rounded="sm" shadow="0 10px 30px #000" />}
            <Dialog.Title asChild>
              <Heading position="absolute" left="6" bottom="4" right="40%" fontSize={{ base: '3xl', md: '4xl' }} fontWeight="900" lineHeight="1">
                {series.title}
              </Heading>
            </Dialog.Title>
            <Dialog.CloseTrigger asChild top="3" right="3">
              <CloseButton bg="#181818" color="white" rounded="full" size="sm" aria-label="Fermer" />
            </Dialog.CloseTrigger>
          </Box>
          <Dialog.Body px="6" pb="6">
            <Flex gap="3" wrap="wrap" align="center" fontSize="sm">
              <Text color="#46d369" fontWeight="bold">
                {series.books.length} {series.books.length > 1 ? 'tomes' : 'livre'} · {read} {read > 1 ? 'lus' : 'lu'}
              </Text>
              <Badge variant="outline" color="muted">{series.kind === 'comics' ? 'BD & manga' : 'Livre'}</Badge>
              <Text color="muted">{direction === 'rtl' ? 'droite → gauche' : 'gauche → droite'}</Text>
            </Flex>
            <Button asChild mt="4" bg="white" color="black" fontWeight="bold" size="lg" w={{ base: 'full', md: 'auto' }} maxW="full" justifyContent="flex-start">
              <a href={readHref(next)}>
                <Marquee as="span" minW="0">▶ {started ? 'Reprendre' : 'Lire'}{series.books.length > 1 ? ` ${next.title}` : ''}</Marquee>
              </a>
            </Button>
            <Flex justify="space-between" align="center" mt="8" mb="2">
              <Heading fontSize="xl">{series.books.length > 1 ? 'Tomes' : 'Livre'}</Heading>
              {missing.length > 1 && (
                <Button size="sm" variant="ghost" color="muted" loading={downloadingAll} onClick={downloadAll}>⤓ Tout télécharger</Button>
              )}
            </Flex>
            {series.books.map((book, i) => (
              <Episode key={book.id} book={book} index={i} progress={progress} offline={offline} onToggleOffline={onToggleOffline} onReset={onReset} />
            ))}
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  )
}

