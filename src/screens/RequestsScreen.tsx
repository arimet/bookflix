import { Box, Button, chakra, CloseButton, type BoxProps, Dialog, Flex, Heading, Image, Input, InputGroup, SimpleGrid, Stack, Text, Textarea } from '@chakra-ui/react'
import { AnimatePresence, motion } from 'motion/react'
import { Loader } from '../components/Loader'
import { foldInOut, popInOut } from '../components/motion'
import { useEffect, useState } from 'react'
import { LuInbox, LuPlay, LuSearch } from 'react-icons/lu'
import { Avatar } from '../components/Avatar'
import { placeholderBg } from '../components/BookCover'
import type { BookRequest, RequestStatus } from '../requests/requests'
import { bookDescription, searchBooks, type BookInfo } from '../requests/search'
import type { Profile } from '../sync/profiles'
import { RED } from '../theme'

// step: how far along the way to the library (Demandé → En cours → Disponible), 0 when it stopped there.
const STATUS: Record<RequestStatus, { label: string; color: string; step: number }> = {
  requested: { label: 'Demandé', color: '#b3b3b3', step: 1 },
  in_progress: { label: 'En cours', color: '#f5a524', step: 2 },
  available: { label: 'Disponible', color: '#46d369', step: 3 },
  refused: { label: 'Refusé', color: RED, step: 0 },
}

type Props = {
  profile: Profile
  profiles: Profile[]
  requests: BookRequest[] | null
  onRequest: (book: BookInfo, note: string) => Promise<void>
  onUpdate: (id: string, changes: Partial<Pick<BookRequest, 'status' | 'adminNote'>>) => Promise<void>
  onRemove: (id: string) => Promise<void>
  onBecomeAdmin: () => void
  onError: (e: unknown) => void
}

const byline = (b: BookInfo) => [b.authors.join(', '), b.year].filter(Boolean).join(' · ')
const isOpen = (r: BookRequest) => r.status === 'requested' || r.status === 'in_progress'

const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })
const UNITS = [['year', 31_536_000], ['month', 2_592_000], ['week', 604_800], ['day', 86_400], ['hour', 3_600], ['minute', 60]] as const
function ago(time: number) {
  const s = (time - Date.now()) / 1000
  const unit = UNITS.find(([, n]) => Math.abs(s) >= n)
  return unit ? rtf.format(Math.round(s / unit[1]), unit[0]) : "à l'instant"
}

const shadow = '0 18px 40px -12px rgba(0,0,0,.9), 0 4px 12px rgba(0,0,0,.4)'

// The BnF gives a cover URL for every record and answers 500 when it has no image: fall back to the title.
function Cover({ book, ...box }: { book: BookInfo } & BoxProps) {
  const [failed, setFailed] = useState(false)
  return (
    <Box aspectRatio={2 / 3} rounded="sm" overflow="hidden" flexShrink={0} bg={placeholderBg(book.title)}
      outline="1px solid rgba(255,255,255,.08)" outlineOffset="-1px" {...box}>
      {book.cover && !failed ? <Image src={book.cover} alt="" w="full" h="full" objectFit="cover" loading="lazy" onError={() => setFailed(true)} />
        : <Box p="2"><Text fontSize="xs" fontWeight="bold" lineClamp={4}>{book.title}</Text></Box>}
    </Box>
  )
}

// Three segments filled up to the request's step, then its status and when it last changed.
function Tracker({ request }: { request: BookRequest }) {
  const status = STATUS[request.status]
  return (
    <Stack gap="1.5">
      <Flex gap="1" aria-hidden>
        {[1, 2, 3].map((i) => <Box key={i} h="1" flex="1" rounded="full" bg={i <= status.step ? status.color : '#333'} />)}
      </Flex>
      <Text fontSize="xs">
        <chakra.span fontWeight="bold" color={status.color}>{status.label}</chakra.span>
        <chakra.span color="muted"> · {ago(request.updatedAt)}</chakra.span>
      </Text>
    </Stack>
  )
}

// Long summaries are folded to a few lines.
function Summary({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Text lineClamp={open ? undefined : 5}>{text}</Text>
      {text.length > 300 && (
        <Button size="xs" variant="plain" color="muted" px="0" onClick={() => setOpen(!open)}>{open ? 'Moins' : 'Lire la suite'}</Button>
      )}
    </>
  )
}

// The book sheet: details and summary, and the "ask for it" button.
export function BookSheet({ book, existing, onRequest, onClose }: { book: BookInfo; existing?: BookRequest; onRequest: Props['onRequest']; onClose: () => void }) {
  const [description, setDescription] = useState<string | null | undefined>(undefined)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    bookDescription(book).then(setDescription, () => setDescription(null))
  }, [book])
  return (
    <Dialog.Root open onOpenChange={(e) => !e.open && onClose()} size="md" placement="center" scrollBehavior="inside">
      <Dialog.Backdrop bg="rgba(0,0,0,.7)" />
      <Dialog.Positioner px="4" pt="max(1rem, env(safe-area-inset-top))" pb="max(1rem, env(safe-area-inset-bottom))">
        <Dialog.Content bg="radial-gradient(ellipse 90% 60% at 15% 0%, #3d1114, #181818 70%)" color="white" my="auto" maxH="full" overflow="hidden">
          <Dialog.CloseTrigger asChild top="3" right="3"><CloseButton size="sm" color="muted" aria-label="Fermer" /></Dialog.CloseTrigger>
          <Dialog.Body p="6">
            <Flex gap="5" pr="8" align="flex-end">
              <Cover book={book} w={{ base: '6rem', sm: '8rem' }} shadow={shadow} />
              <Stack gap="2" minW="0">
                <Dialog.Title asChild><Heading fontSize={{ base: 'lg', sm: '2xl' }} fontWeight="900" lineHeight="1.15" lineClamp={3} textWrap="balance">{book.title}</Heading></Dialog.Title>
                <Text color="muted">{byline(book)}</Text>
                <Text fontSize="sm" color="muted">{[book.publisher, book.pages && `${book.pages} pages`, book.isbn && `ISBN ${book.isbn}`].filter(Boolean).join(' · ')}</Text>
              </Stack>
            </Flex>
            <Box mt="5" fontSize="sm" color="#ddd" whiteSpace="pre-line">
              {description === undefined ? <Loader small /> : description ? <Summary text={description} /> : <Text color="muted">Pas de résumé disponible.</Text>}
            </Box>
            {existing ? (
              <Box mt="6"><Text fontWeight="bold" mb="2">Déjà demandé</Text><Tracker request={existing} /></Box>
            ) : (
              <Stack mt="6" gap="3">
                <Textarea rows={2} placeholder="Un mot pour l'admin (facultatif) : édition, langue…" value={note} onChange={(e) => setNote(e.target.value)} bg="rgba(0,0,0,.5)" borderColor="#3a3a3a" />
                <Button bg="brand" color="white" size="lg" fontWeight="bold" loading={busy} onClick={() => { setBusy(true); onRequest(book, note).finally(() => setBusy(false)) }}>
                  Demander ce livre
                </Button>
              </Stack>
            )}
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  )
}

function RequestCard({ request, who, actions, onCancel }: { request: BookRequest; who?: Profile; actions: React.ReactNode; onCancel?: () => void }) {
  return (
    <Flex position="relative" gap="4" p="4" bg="panel" rounded="lg" outline="1px solid rgba(255,255,255,.06)" align="flex-start" transition="background .2s" _hover={{ bg: '#1d1d1d' }}>
      {onCancel && <CloseButton size="sm" position="absolute" top="2" right="2" color="muted" aria-label="Annuler la demande" onClick={onCancel} />}
      <Cover book={request.book} w={{ base: '4.5rem', md: '5.5rem' }} shadow={shadow} />
      <Stack gap="3" flex="1" minW="0">
        <Box pe={onCancel ? '8' : undefined}>
          <Text fontWeight="bold" lineHeight="1.3" lineClamp={2}>{request.book.title}</Text>
          <Text fontSize="sm" color="muted" truncate>{byline(request.book)}</Text>
        </Box>
        <Tracker request={request} />
        {who && <Flex gap="2" align="center" fontSize="sm" color="muted"><Avatar profile={who} size="1.25rem" rounded="sm" />Demandé par <chakra.span color="white">{who.name}</chakra.span></Flex>}
        {request.note && <Text fontSize="sm" color="#ddd" fontStyle="italic">« {request.note} »</Text>}
        {request.adminNote && (
          <Text fontSize="sm" bg="rgba(255,255,255,.05)" rounded="md" px="3" py="2"><chakra.span color="muted">Admin : </chakra.span>{request.adminNote}</Text>
        )}
        <Flex gap="2" wrap="wrap" align="center" _empty={{ display: 'none' }} css={{ '& > *': { height: '2.25rem' } }}>{actions}</Flex>
      </Stack>
    </Flex>
  )
}

function AdminControls({ request, onUpdate }: { request: BookRequest; onUpdate: Props['onUpdate'] }) {
  const [status, setStatus] = useState(request.status)
  const [note, setNote] = useState(request.adminNote ?? '')
  const [busy, setBusy] = useState(false)
  const changed = status !== request.status || note !== (request.adminNote ?? '')
  return (
    <>
      <chakra.select value={status} onChange={(e) => setStatus(e.target.value as RequestStatus)} bg="black" color="white"
        borderWidth="1px" borderColor="#444" rounded="md" px="2" fontSize="sm" aria-label="Statut">
        {Object.entries(STATUS).map(([value, s]) => <option key={value} value={value}>{s.label}</option>)}
      </chakra.select>
      <Input size="sm" flex="1" minW="10rem" placeholder="Mot pour le lecteur" value={note} onChange={(e) => setNote(e.target.value)} bg="black" />
      <Button size="sm" bg="brand" color="white" disabled={!changed} loading={busy}
        onClick={() => { setBusy(true); onUpdate(request.id, { status, adminNote: note.trim() || undefined }).finally(() => setBusy(false)) }}>
        Enregistrer
      </Button>
    </>
  )
}

// The last requested covers, fanned out beside the title on a wide screen.
function Fan({ books }: { books: BookInfo[] }) {
  const spread = [{ r: -9, x: -5.5, y: 0.8 }, { r: 8, x: 5.5, y: 0.8 }, { r: 0, x: 0, y: 0 }]
  return (
    <Box display={{ base: 'none', md: 'block' }} position="relative" w="20rem" h="15rem" flexShrink={0} aria-hidden>
      {books.slice(0, 3).reverse().map((b, i, all) => {
        const at = spread[3 - all.length + i]
        return (
          <Cover key={b.id} book={b} position="absolute" left="50%" bottom="0" w="9rem" shadow={shadow}
            transform={`translateX(calc(-50% + ${at.x}rem)) translateY(${at.y}rem) rotate(${at.r}deg)`} transformOrigin="bottom center" />
        )
      })}
    </Box>
  )
}

function Group({ title, requests, render }: { title: string; requests: BookRequest[]; render: (r: BookRequest) => React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {requests.length > 0 && (
        <motion.div key="group" {...foldInOut}>
          <Box pt="8">
            <Heading as="h3" fontSize="md" fontWeight="bold" mb="3">{title} <chakra.span color="muted" fontWeight="normal">{requests.length}</chakra.span></Heading>
            <SimpleGrid columns={{ base: 1, lg: 2 }} gap="3" position="relative">
              <AnimatePresence mode="popLayout" initial={false}>
                {requests.map((r) => <motion.div key={r.id} {...popInOut}>{render(r)}</motion.div>)}
              </AnimatePresence>
            </SimpleGrid>
          </Box>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function RequestsScreen({ profile, profiles, requests, onRequest, onUpdate, onRemove, onBecomeAdmin, onError }: Props) {
  const [query, setQuery] = useState('')
  const [searched, setSearched] = useState('')
  const [results, setResults] = useState<BookInfo[] | null>(null)
  const [unavailable, setUnavailable] = useState<string[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState<BookInfo | null>(null)

  const search = async () => {
    setSearching(true)
    try {
      const { books, unavailable } = await searchBooks(query)
      setResults(books)
      setUnavailable(unavailable)
      setSearched(query.trim())
    } catch (e) {
      onError(e)
    } finally {
      setSearching(false)
    }
  }

  const mine = (requests ?? []).filter((r) => r.profileId === profile.id).sort((a, b) => b.updatedAt - a.updatedAt)
  // The admin sees everyone's requests including their own; new requests first.
  const shown = profile.admin
    ? [...(requests ?? [])].sort((a, b) => Number(b.status === 'requested') - Number(a.status === 'requested') || b.createdAt - a.createdAt)
    : mine
  const openRequest = (bookId: string) => mine.find((r) => r.book.id === bookId && isOpen(r))
  const hasAdmin = profiles.some((p) => p.admin)
  const readLink = (r: BookRequest) => r.status === 'available' && r.libraryBookId && (
    <Button asChild size="sm" bg="white" color="black" fontWeight="bold"><a href={`#/read/${encodeURIComponent(r.libraryBookId)}`}><LuPlay fill="currentColor" /> Lire</a></Button>
  )
  const card = (r: BookRequest) => {
    const onCancel = r.profileId === profile.id && r.status === 'requested' ? () => onRemove(r.id) : undefined
    return profile.admin
      ? <RequestCard key={r.id} request={r} who={profiles.find((p) => p.id === r.profileId)} onCancel={onCancel}
          actions={<>{readLink(r)}<AdminControls request={r} onUpdate={onUpdate} /></>} />
      : <RequestCard key={r.id} request={r} onCancel={onCancel} actions={readLink(r)} />
  }

  return (
    <Box pb="16">
      <Box bg="radial-gradient(ellipse 70% 120% at 85% 0%, #4a1216, #141414 65%)">
        <Flex maxW="6xl" px={{ base: 4, md: 12 }} pt={{ base: 'calc(env(safe-area-inset-top) + 7rem)', md: 28 }} pb={{ base: 8, md: 12 }}
          align="flex-end" justify="space-between" gap="12">
          <Box flex="1" minW="0" maxW="2xl">
            <Heading fontSize={{ base: '3xl', md: '5xl' }} fontWeight="900" letterSpacing="-0.02em" lineHeight="1">Demandes</Heading>
            <Text color="muted" fontSize={{ md: 'lg' }} mt="3" mb="6">Un livre manque à la bibliothèque ? Cherche-le et demande-le.</Text>
            <Flex as="form" gap="2" onSubmit={(e) => { e.preventDefault(); search() }}>
              <InputGroup flex="1" startElement={<LuSearch size="1.25rem" />} startElementProps={{ color: 'muted', ps: '4' }}>
                <Input h={{ base: '12', md: '14' }} ps="12" fontSize="md" placeholder="Titre, auteur, ISBN…" value={query} onChange={(e) => setQuery(e.target.value)}
                  bg="rgba(0,0,0,.55)" borderColor="#3a3a3a" _hover={{ borderColor: '#555' }} aria-label="Rechercher un livre" />
              </InputGroup>
              <Button type="submit" h={{ base: '12', md: '14' }} px={{ base: 4, md: 7 }} bg="brand" color="white" fontWeight="bold" loading={searching} disabled={!query.trim()}>
                Rechercher
              </Button>
            </Flex>
          </Box>
          {mine.length > 0 && <Fan books={mine.map((r) => r.book)} />}
        </Flex>
      </Box>

      <Box px={{ base: 4, md: 12 }} maxW="6xl">
        {searching && !results && (
          <SimpleGrid columns={{ base: 3, sm: 4, md: 6 }} gap="4" mt="4">
            {Array.from({ length: 6 }, (_, i) => <Box key={i} className="bf-shimmer" aspectRatio={2 / 3} rounded="sm" />)}
          </SimpleGrid>
        )}
        {results && (
          <Box mt="4" opacity={searching ? 0.5 : 1} transition="opacity .2s">
            <Heading as="h2" fontSize="xl" fontWeight="bold" mb="4">
              {results.length ? <>Résultats pour « {searched} » <chakra.span color="muted" fontWeight="normal">{results.length}</chakra.span></> : `Rien trouvé pour « ${searched} »`}
            </Heading>
            {results.length > 0 && (
              <SimpleGrid columns={{ base: 3, sm: 4, md: 6 }} gap="4" rowGap="6">
                {results.map((b) => {
                  const asked = openRequest(b.id)
                  return (
                    <chakra.button key={b.id} textAlign="left" onClick={() => setOpen(b)} className="group" rounded="sm">
                      <Box position="relative" transition="transform .25s cubic-bezier(.16,1,.3,1)" _groupHover={{ transform: 'translateY(-4px)' }}>
                        <Cover book={b} w="full" transition="box-shadow .25s" _groupHover={{ shadow }} />
                        {asked && (
                          <Text position="absolute" top="1.5" left="1.5" fontSize="2xs" fontWeight="bold" bg="rgba(0,0,0,.8)" color={STATUS[asked.status].color} px="1.5" py="0.5" rounded="sm">
                            {STATUS[asked.status].label}
                          </Text>
                        )}
                      </Box>
                      <Text fontSize="xs" mt="2" fontWeight="bold" lineClamp={2}>{b.title}</Text>
                      <Text fontSize="xs" color="muted" lineClamp={1}>{byline(b)}</Text>
                    </chakra.button>
                  )
                })}
              </SimpleGrid>
            )}
            <Text fontSize="xs" color="muted" mt="5">
              {unavailable.length
                ? `Résultats partiels : ${unavailable.join(' et ')} ne répond pas pour le moment, réessaie plus tard.`
                : `Résultats : ${import.meta.env.VITE_GOOGLE_BOOKS_KEY ? 'Google Books, ' : ''}catalogue de la BnF et Open Library.`}
            </Text>
          </Box>
        )}

        <Heading as="h2" fontSize="xl" fontWeight="bold" mt={results || searching ? '14' : '4'}>
          {profile.admin ? 'Toutes les demandes' : 'Mes demandes'}
        </Heading>
        {!requests ? <Box mt="6"><Loader small /></Box> : !shown.length ? (
          <Flex mt="5" direction="column" align="center" gap="3" py="12" px="6" rounded="lg" border="1px dashed #333" textAlign="center">
            <Box color="muted"><LuInbox size="2rem" /></Box>
            <Text fontWeight="bold">Aucune demande pour l'instant</Text>
            <Text fontSize="sm" color="muted" maxW="sm">Cherche un titre au-dessus : il arrivera ici, et passera en « Disponible » dès qu'il sera dans la bibliothèque.</Text>
          </Flex>
        ) : (
          <>
            <Group title="En attente" requests={shown.filter(isOpen)} render={card} />
            <Group title="Disponibles" requests={shown.filter((r) => r.status === 'available')} render={card} />
            <Group title="Refusées" requests={shown.filter((r) => r.status === 'refused')} render={card} />
          </>
        )}

        {!hasAdmin && (
          <Button mt="12" size="sm" variant="ghost" color="muted" onClick={onBecomeAdmin}>
            Devenir admin des demandes de ce Dropbox
          </Button>
        )}
      </Box>

      {open && (
        <BookSheet book={open} existing={openRequest(open.id)}
          onRequest={async (b, note) => { await onRequest(b, note); setOpen(null) }} onClose={() => setOpen(null)} />
      )}
    </Box>
  )
}
