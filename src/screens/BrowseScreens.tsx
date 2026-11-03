import { Box, Button, chakra, Flex, Heading, Stack, Text } from '@chakra-ui/react'
import { AnimatePresence, motion } from 'motion/react'
import { BookCover } from '../components/BookCover'
import { BookMenu } from '../components/BookMenu'
import { LibrarySkeleton } from '../components/Loader'
import { readHref } from '../routes'
import { BookCard, SeriesCard, SeriesGrid } from '../components/Cards'
import { COVER_SPACE, Hero } from '../components/Hero'
import { popInOut } from '../components/motion'
import { Row } from '../components/Row'
import { heroPick, newestBook, ofKind, readingHistory, readingNow, recentlyAdded, searchLibrary, seriesOfBook, type Kind, type Series } from '../library/catalog'
import type { Book } from '../library/library'
import type { ProgressMap } from '../sync/progress'

type Data = { series: Series[] | null; progress: ProgressMap; offline: Set<string>; onReset: (book: Book) => void; onToggleOffline: (book: Book) => void }

// "Boruto · Tome 02" when the book belongs to a series of several volumes
const bookLabel = (series: Series[], b: Book) => {
  const s = seriesOfBook(series, b.id)!
  return s.books.length > 1 ? `${s.title} · ${b.title}` : b.title
}


export function HomeScreen({ series, progress, offline, onReset, onToggleOffline, libraryName, onChangeFolder }: Data & { libraryName: string; onChangeFolder: () => void }) {
  if (!series) return <LibrarySkeleton />
  if (!series.length) {
    return (
      <Box minH="100dvh" display="grid" placeItems="center" p="6" textAlign="center">
        <Stack gap="3" align="center">
          <Text color="muted">Aucun livre dans le dossier {libraryName} de ton Dropbox (EPUB, CBZ, CBR ou PDF).</Text>
          <Button variant="outline" size="sm" onClick={onChangeFolder}>Changer de dossier</Button>
        </Stack>
      </Box>
    )
  }
  const hero = heroPick(series, progress)
  const books = series.flatMap((s) => s.books)
  const label = (b: Book) => bookLabel(series, b)
  const card = (b: Book) => (
    <BookCard key={b.id} book={b} label={label(b)} percent={progress[b.id]?.percent}
      onReset={(progress[b.id]?.percent ?? 0) > 0 ? () => onReset(b) : undefined}
      onDownload={offline.has(b.id) ? undefined : () => onToggleOffline(b)}
      onRemoveOffline={offline.has(b.id) ? () => onToggleOffline(b) : undefined} />
  )
  return (
    <Box pb="16">
      {hero && <Hero series={hero.series} book={hero.book} percent={progress[hero.book.id]?.percent ?? 0} />}
      <Stack gap={{ base: 6, md: 10 }} mt={{ base: -6, md: -16 }} position="relative"
        css={hero ? { '& > section:first-of-type': { w: { md: `calc(100% - ${COVER_SPACE})` } } } : undefined}>
        <Row title="Reprendre la lecture" small>
          {readingNow(series, progress).slice(0, 20).map(card)}
        </Row>
        <Row title="Téléchargés">
          {books.filter((b) => offline.has(b.id)).map(card)}
        </Row>
        <Row title="Ajoutés récemment">{recentlyAdded(series).map((s) => <SeriesCard key={s.key} series={s} cover={newestBook(s)} />)}</Row>
        <Row title="BD & mangas">{ofKind(series, 'comics').map((s) => <SeriesCard key={s.key} series={s} />)}</Row>
        <Row title="Livres">{ofKind(series, 'books').map((s) => <SeriesCard key={s.key} series={s} />)}</Row>
      </Stack>
    </Box>
  )
}

const Page = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Box pt={{ base: 'calc(env(safe-area-inset-top) + 7rem)', md: 28 }} px={{ base: 4, md: 12 }} pb="16">
    <Heading fontSize={{ base: '2xl', md: '4xl' }} fontWeight="900" mb="6">{title}</Heading>
    {children}
  </Box>
)

export function KindScreen({ series, kind }: { series: Series[] | null; kind: Kind }) {
  if (!series) return <LibrarySkeleton />
  return <Page title={kind === 'comics' ? 'BD & mangas' : 'Livres'}><SeriesGrid series={ofKind(series, kind)} /></Page>
}

export function SearchScreen({ series, query }: { series: Series[] | null; query: string }) {
  if (!series) return <LibrarySkeleton />
  const results = searchLibrary(series, query)
  return (
    <Page title={query.trim() ? `Résultats pour « ${query.trim()} »` : 'Rechercher'}>
      {query.trim() && !results.series.length && !results.books.length ? <Text color="muted">Aucun titre ne correspond.</Text>
        : <SeriesGrid series={results.series}>{results.books.map((b) => <BookCard key={b.id} book={b} label={bookLabel(series, b)} />)}</SeriesGrid>}
    </Page>
  )
}

const when = new Intl.DateTimeFormat('fr', { dateStyle: 'medium', timeStyle: 'short' })

export function HistoryScreen({ series, progress, offline, onReset, onToggleOffline }: Data) {
  if (!series) return <LibrarySkeleton />
  const items = readingHistory(series, progress)
  return (
    <Page title="Historique de lecture">
      {!items.length && <Text color="muted">Aucun livre ouvert pour l'instant.</Text>}
      <Stack gap="0" maxW="3xl" position="relative">
        <AnimatePresence mode="popLayout" initial={false}>
        {items.map(({ book, series: s, entry }) => (
          <motion.div key={book.id} {...popInOut}>
          <Flex gap="4" align="center" py="3" borderTop="1px solid #2e2e2e" position="relative">
            <BookMenu title={book.title} onReset={() => onReset(book)} onDownload={offline.has(book.id) ? undefined : () => onToggleOffline(book)}
              onRemoveOffline={offline.has(book.id) ? () => onToggleOffline(book) : undefined} button={{ top: 'calc(50% - 0.75rem)', right: '0' }}>
              <chakra.a href={readHref(book)} display="flex" gap="4" alignItems="center" flex="1" minW="0" pr="10">
                <Box w="12" flexShrink={0}><BookCover book={book} small percent={entry.percent} /></Box>
                <Stack gap="0.5" minW="0">
                  <Text fontWeight="bold" truncate>{s.books.length > 1 ? `${s.title} · ${book.title}` : book.title}</Text>
                  <Text fontSize="sm" color="muted">
                    {when.format(entry.updatedAt)} · {entry.percent >= 0.99 ? 'Lu' : `${Math.round(entry.percent * 100)} %`} · {entry.device}
                  </Text>
                </Stack>
              </chakra.a>
            </BookMenu>
          </Flex>
          </motion.div>
        ))}
        </AnimatePresence>
      </Stack>
    </Page>
  )
}
