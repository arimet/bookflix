import { Badge, Box, Button, chakra, CloseButton, type BoxProps, Dialog, Flex, Heading, Image, Input, SimpleGrid, Stack, Text, Textarea } from '@chakra-ui/react'
import { Loader } from '../components/Loader'
import { useEffect, useState } from 'react'
import { Avatar } from '../components/Avatar'
import { placeholderBg } from '../components/BookCover'
import type { BookRequest, RequestStatus } from '../requests/requests'
import { bookDescription, searchBooks, type BookInfo } from '../requests/search'
import type { Profile } from '../sync/profiles'

const STATUS: Record<RequestStatus, { label: string; color: string }> = {
  requested: { label: 'Demandé', color: 'gray' },
  in_progress: { label: 'En cours', color: 'orange' },
  available: { label: 'Disponible', color: 'green' },
  refused: { label: 'Refusé', color: 'red' },
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

// The BnF gives a cover URL for every record and answers 500 when it has no image: fall back to the title.
function Cover({ book, w }: { book: BookInfo; w: BoxProps['w'] }) {
  const [failed, setFailed] = useState(false)
  return (
    <Box w={w} aspectRatio={2 / 3} rounded="sm" overflow="hidden" flexShrink={0} bg={placeholderBg(book.title)}>
      {book.cover && !failed ? <Image src={book.cover} alt="" w="full" h="full" objectFit="cover" loading="lazy" onError={() => setFailed(true)} />
        : <Box p="2"><Text fontSize="xs" fontWeight="bold" lineClamp={4}>{book.title}</Text></Box>}
    </Box>
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
        <Dialog.Content bg="panel" color="white" my="auto" maxH="full">
          <Dialog.CloseTrigger asChild top="3" right="3"><CloseButton size="sm" color="muted" aria-label="Fermer" /></Dialog.CloseTrigger>
          <Dialog.Body p="6">
            <Flex gap="4" pr="8">
              <Cover book={book} w={{ base: '5.5rem', sm: '7rem' }} />
              <Stack gap="2" minW="0">
                <Dialog.Title asChild><Heading fontSize={{ base: 'lg', sm: 'xl' }} fontWeight="900" lineClamp={3}>{book.title}</Heading></Dialog.Title>
                <Text color="muted">{byline(book)}</Text>
                <Text fontSize="sm" color="muted">{[book.publisher, book.pages && `${book.pages} pages`, book.isbn && `ISBN ${book.isbn}`].filter(Boolean).join(' · ')}</Text>
              </Stack>
            </Flex>
            <Box mt="4" fontSize="sm" color="#ddd" whiteSpace="pre-line">
              {description === undefined ? <Loader small /> : description ? <Summary text={description} /> : <Text color="muted">Pas de résumé disponible.</Text>}
            </Box>
            {existing ? (
              <Text mt="5" fontWeight="bold">Déjà demandé · {STATUS[existing.status].label}</Text>
            ) : (
              <Stack mt="5" gap="3">
                <Textarea rows={2} placeholder="Un mot pour l'admin (facultatif) : édition, langue…" value={note} onChange={(e) => setNote(e.target.value)} bg="black" />
                <Button bg="brand" color="white" loading={busy} onClick={() => { setBusy(true); onRequest(book, note).finally(() => setBusy(false)) }}>
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

function RequestRow({ request, who, actions }: { request: BookRequest; who?: Profile; actions: React.ReactNode }) {
  const status = STATUS[request.status]
  return (
    <Flex gap="4" py="3" borderTop="1px solid #2e2e2e" align="flex-start">
      <Cover book={request.book} w="3.5rem" />
      <Stack gap="1" flex="1" minW="0">
        <Flex gap="2" align="center" wrap="wrap">
          <Text fontWeight="bold" lineHeight="1.5rem" truncate>{request.book.title}</Text>
          <Badge colorPalette={status.color} h="1.5rem" display="inline-flex" alignItems="center">{status.label}</Badge>
        </Flex>
        <Text fontSize="sm" color="muted">{byline(request.book)}</Text>
        {who && <Flex gap="2" align="center" fontSize="sm"><Avatar profile={who} size="1.25rem" rounded="sm" />{who.name}</Flex>}
        {request.note && <Text fontSize="sm">« {request.note} »</Text>}
        {request.adminNote && <Text fontSize="sm" color="#46d369">Admin : {request.adminNote}</Text>}
        <Flex gap="2" mt="1" wrap="wrap" align="center" css={{ '& > *': { height: '2.25rem' } }}>{actions}</Flex>
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
      <Input size="sm" maxW="56" placeholder="Mot pour le lecteur" value={note} onChange={(e) => setNote(e.target.value)} bg="black" />
      <Button size="sm" bg="brand" color="white" disabled={!changed} loading={busy}
        onClick={() => { setBusy(true); onUpdate(request.id, { status, adminNote: note.trim() || undefined }).finally(() => setBusy(false)) }}>
        Enregistrer
      </Button>
    </>
  )
}

export function RequestsScreen({ profile, profiles, requests, onRequest, onUpdate, onRemove, onBecomeAdmin, onError }: Props) {
  const [query, setQuery] = useState('')
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
    } catch (e) {
      onError(e)
    } finally {
      setSearching(false)
    }
  }

  const mine = (requests ?? []).filter((r) => r.profileId === profile.id).sort((a, b) => b.updatedAt - a.updatedAt)
  // The admin sees one list, everyone's requests including their own; new requests first.
  const all = [...(requests ?? [])].sort((a, b) => Number(b.status === 'requested') - Number(a.status === 'requested') || b.createdAt - a.createdAt)
  const hasAdmin = profiles.some((p) => p.admin)
  const cancel = (r: BookRequest) => <Button size="sm" variant="ghost" color="muted" onClick={() => onRemove(r.id)}>Annuler</Button>
  const readLink = (r: BookRequest) => r.status === 'available' && r.libraryBookId && (
    <Button asChild size="sm" bg="white" color="black"><a href={`#/read/${encodeURIComponent(r.libraryBookId)}`}>▶ Lire</a></Button>
  )

  return (
    <Box pt={{ base: 'calc(env(safe-area-inset-top) + 7rem)', md: 28 }} px={{ base: 4, md: 12 }} pb="16" maxW="5xl">
      <Heading fontSize={{ base: '2xl', md: '4xl' }} fontWeight="900" mb="2">Demandes</Heading>
      <Text color="muted" mb="6">Cherche un livre qui n'est pas dans la bibliothèque et demande-le.</Text>

      <Flex as="form" gap="2" maxW="xl" onSubmit={(e) => { e.preventDefault(); search() }}>
        <Input placeholder="Titre, auteur, ISBN…" value={query} onChange={(e) => setQuery(e.target.value)} bg="black" aria-label="Rechercher un livre" />
        <Button type="submit" bg="brand" color="white" loading={searching} disabled={!query.trim()}>Rechercher</Button>
      </Flex>

      {results && (
        <Box mt="6">
          {!results.length ? <Text color="muted">Aucun livre trouvé.</Text> : (
            <SimpleGrid columns={{ base: 3, sm: 4, md: 6 }} gap="4" rowGap="6">
              {results.map((b) => (
                <chakra.button key={b.id} textAlign="left" onClick={() => setOpen(b)} transition="transform .2s" _hover={{ transform: 'scale(1.04)' }}>
                  <Cover book={b} w="full" />
                  <Text fontSize="xs" mt="1.5" fontWeight="bold" lineClamp={2}>{b.title}</Text>
                  <Text fontSize="xs" color="muted" lineClamp={1}>{byline(b)}</Text>
                </chakra.button>
              ))}
            </SimpleGrid>
          )}
          <Text fontSize="xs" color="muted" mt="4">
            {unavailable.length
              ? `Résultats partiels : ${unavailable.join(' et ')} ne répond pas pour le moment, réessaie plus tard.`
              : `Résultats : ${import.meta.env.VITE_GOOGLE_BOOKS_KEY ? 'Google Books, ' : ''}catalogue de la BnF et Open Library.`}
          </Text>
        </Box>
      )}

      {profile.admin ? (
        <>
          <Heading fontSize="xl" mt="12" mb="2">Toutes les demandes</Heading>
          {!requests ? <Loader small /> : !all.length ? <Text color="muted">Aucune demande.</Text> : all.map((r) => (
            <RequestRow key={r.id} request={r} who={profiles.find((p) => p.id === r.profileId)}
              actions={<>
                {readLink(r)}
                <AdminControls request={r} onUpdate={onUpdate} />
                {r.profileId === profile.id && r.status === 'requested' && cancel(r)}
              </>} />
          ))}
        </>
      ) : (
        <>
          <Heading fontSize="xl" mt="12" mb="2">Mes demandes</Heading>
          {!requests ? <Loader small /> : !mine.length ? <Text color="muted">Aucune demande pour l'instant.</Text> : mine.map((r) => (
            <RequestRow key={r.id} request={r} actions={<>{readLink(r)}{r.status === 'requested' && cancel(r)}</>} />
          ))}
        </>
      )}

      {!hasAdmin && (
        <Button mt="12" size="sm" variant="ghost" color="muted" onClick={onBecomeAdmin}>
          Devenir admin des demandes de ce Dropbox
        </Button>
      )}

      {open && (
        <BookSheet book={open} existing={mine.find((r) => r.book.id === open.id && (r.status === 'requested' || r.status === 'in_progress'))}
          onRequest={async (b, note) => { await onRequest(b, note); setOpen(null) }} onClose={() => setOpen(null)} />
      )}
    </Box>
  )
}
