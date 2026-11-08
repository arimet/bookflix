import { Box, Button, Flex, IconButton, Stack, Text } from '@chakra-ui/react'
import { BookCover } from '../components/BookCover'
import { DebugLog, DEBUG } from '../components/DebugLog'
import { Loader } from '../components/Loader'
import { Shell } from '../components/PinDialogs'
import { ZoomPageBar } from '../components/ZoomPageBar'
import { ReactReader, type ReactReaderSettings } from '@prose-reader/react-reader'
import '@prose-reader/react-reader/index.css'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { LuPlay, LuX } from 'react-icons/lu'
import { AuthError } from '../dropbox/auth'
import type { Book } from '../library/library'
import { markSpineItemOnScreen, tapSide, turnOnEdgePulls, turnOnSideTaps, turnOnSwipeUpToClose, turnTowards, watchLastPage, whenPageOnScreenReady, type AppReader } from '../reader/createAppReader'
import { openReader } from '../reader/openReader'
import { readHref } from '../routes'
import { cachedBookSettings, defaultDirection, loadBookSettings, setBookDirection, type Direction } from '../sync/books'
import { positionRecorder } from '../sync/positionRecorder'
import { deviceName, flushPending, localProgress, recordProgress } from '../sync/progress'

const SETTINGS_KEY = 'bookflix.readerSettings'
const LAYOUT_KEY = 'bookflix.readerLayout'

// The page sits in a centred column of `width` rem; at FULL_WIDTH it takes the whole screen.
// lineHeight 'publisher' keeps the book's own spacing.
type ReaderTheme = 'night' | 'sepia' | 'bright'
type Layout = { width: number; lineHeight: number | 'publisher'; theme: ReaderTheme }
const DEFAULT_LAYOUT: Layout = { width: 52, lineHeight: 'publisher', theme: 'night' }
const THEMES: { theme: ReaderTheme; label: string; bg: string }[] = [
  { theme: 'bright', label: 'Clair', bg: '#ffffff' },
  { theme: 'sepia', label: 'Sépia', bg: '#eaddc5' },
  { theme: 'night', label: 'Sombre', bg: '#191717' },
]
const FULL_WIDTH = 100
const columnWidth = (width: number) => (width >= FULL_WIDTH ? '100%' : `${width}rem`)
const FLUSH_DELAY = 5000
// prose-reader shows a zoom slider while zoomed in, with no setting to turn it off; pinching does the same.
// ponytail: matches prose-reader's markup (the slider in a presence box right under the reader); recheck on upgrade.
const HIDE_ZOOM_SLIDER = { '& [data-prose-react-reader] > [data-scope="presence"]:has(> [data-scope="slider"])': { display: 'none' } }
// The page runs down to the bottom of the screen, under the iPhone's home bar; the bottom menu (the one with
// the Help button) and the clock shown with it stay above that bar, the menu's background running under it.
// ponytail: matches prose-reader's markup, like HIDE_ZOOM_SLIDER; recheck on upgrade.
const ABOVE_HOME_BAR = {
  '& [data-prose-react-reader] > [data-scope="presence"]:has([aria-label="Help"])': { paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' },
  '& [data-prose-react-reader] > [data-scope="presence"]:not(:has(button)) > div:has(> p:only-child)': { bottom: 'env(safe-area-inset-bottom)' },
}
const CLOSE_DURATION = 200

// next: the following volume of the series, offered on the last page.
type Props = { book: Book; next?: Book; profileId: string; onBack: () => void; onError: (e: unknown) => void }

export function ReaderScreen({ book, next, profileId, onBack, onError }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const sheetRef = useRef<HTMLDivElement | null>(null) // what a swipe up moves
  const onBackRef = useRef(onBack)
  useLayoutEffect(() => {
    onBackRef.current = onBack
  })
  const [atEnd, setAtEnd] = useState(false)
  const [nextDismissed, setNextDismissed] = useState(false)
  const [reader, setReader] = useState<AppReader>()
  // The reader whose first page is drawn; our loader covers it until then.
  const [drawn, setDrawn] = useState<AppReader>()
  const [direction, setDirection] = useState<Direction>()
  const [failed, setFailed] = useState<string>() // the error, shown to tell what went wrong
  const [menuOpen, setMenuOpen] = useState(false)
  // Bumped to reopen the book, e.g. after a direction change; the latest position is reread then.
  const [session, setSession] = useState(0)
  // One page at a time unless the reader picks two in the Layout menu.
  const [settings, setSettings] = useState<ReactReaderSettings>(() => ({ spreadMode: 'never', ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') }))
  const [layout, setLayout] = useState<Layout>(() => ({ ...DEFAULT_LAYOUT, ...JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? '{}') }))

  const changeLayout = (changes: Partial<Layout>) =>
    setLayout((old) => {
      const next = { ...old, ...changes }
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(next))
      return next
    })

  useEffect(() => {
    reader?.settings.update({ lineHeight: layout.lineHeight })
  }, [reader, layout.lineHeight])

  useEffect(() => {
    reader?.theme.set(layout.theme)
  }, [reader, layout.theme])

  useEffect(() => {
    if (!reader) return
    const marks = markSpineItemOnScreen(reader)
    const ready = whenPageOnScreenReady(reader, () => setDrawn(reader))
    const unregisterTaps = turnOnSideTaps(reader)
    const pulls = turnOnEdgePulls(reader)
    const end = watchLastPage(reader, setAtEnd)
    const style = (transform: string, opacity: string, transition: string) => {
      const sheet = sheetRef.current
      if (sheet) Object.assign(sheet.style, { transform, opacity, transition })
    }
    const swipe = turnOnSwipeUpToClose(reader, {
      onMove: (pull) => pull
        ? style(`translateY(${pull}px)`, String(Math.max(0.3, 1 + pull / innerHeight)), 'none')
        : style('', '', 'transform .25s, opacity .25s'),
      onClose: () => {
        style('translateY(-100%)', '0', `transform ${CLOSE_DURATION}ms ease-in, opacity ${CLOSE_DURATION}ms`)
        setTimeout(() => onBackRef.current(), CLOSE_DURATION)
      },
    })
    return () => {
      swipe.unsubscribe()
      end.unsubscribe()
      setAtEnd(false)
      pulls.unsubscribe()
      marks.unsubscribe()
      ready.unsubscribe()
      unregisterTaps()
    }
  }, [reader])

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [settings])

  // The App rebuilds the book object whenever the file list or offline set refreshes; only a new
  // id or rev means a different book to open.
  const bookRef = useRef(book)
  useLayoutEffect(() => {
    bookRef.current = book
  })
  const bookId = book.id
  const rev = book.file.rev

  useEffect(() => {
    const book = bookRef.current
    let cancelled = false
    let cleanup = () => {}
    let timer: ReturnType<typeof setTimeout> | undefined
    const flush = () => {
      clearTimeout(timer)
      flushPending(profileId).catch(() => {}) // stays pending, retried on reconnect
    }
    const onVisibility = () => document.visibilityState === 'hidden' && flush()

    ;(async () => {
      // Local copies: the library screen refreshed progress just before, so opening waits on no extra call.
      const progress = localProgress(profileId)
      const bookSettings = cachedBookSettings()
      loadBookSettings().catch(() => {}) // refreshes the cache for next time
      const dir = bookSettings[book.id]?.direction ?? defaultDirection(book.format)
      const saved = progress[book.id]
      const { reader: instance, close } = await openReader(book, dir, saved?.cfi ? { type: 'cfi', value: saved.cfi } : undefined)
      if (cancelled || !containerRef.current) {
        instance.destroy()
        return close()
      }
      instance.mount(containerRef.current)

      const record = positionRecorder()
      const sub = instance.navigation.readingPosition$.subscribe((position) => {
        const read = record(position)
        if (!read) return
        recordProgress(profileId, book.id, { ...read, updatedAt: Date.now(), device: deviceName() })
        clearTimeout(timer)
        timer = setTimeout(flush, FLUSH_DELAY)
      })
      document.addEventListener('visibilitychange', onVisibility)
      setDirection(dir)
      setReader(instance)

      cleanup = () => {
        sub.unsubscribe()
        document.removeEventListener('visibilitychange', onVisibility)
        flush()
        instance.destroy()
        close()
      }
    })().catch((e) => {
      if (cancelled) return
      console.error(e)
      setFailed(e instanceof Error ? e.message : String(e))
      // Auth problems must still send the user back to the login screen.
      if (e instanceof AuthError) onError(e)
    })

    return () => {
      cancelled = true
      setReader(undefined)
      cleanup()
    }
  }, [bookId, rev, profileId, session, onError])

  const changeDirection = async (next: Direction) => {
    try {
      await setBookDirection(book.id, next)
      setMenuOpen(false)
      setSession((s) => s + 1)
    } catch (e) {
      onError(e)
    }
  }

  if (failed !== undefined) {
    return (
      <Box minH="100dvh" display="grid" placeItems="center" p="6">
        <Stack gap="4" align="center" textAlign="center">
          <Text>Impossible d'ouvrir ce livre.</Text>
          <Text fontSize="sm" color="muted">{failed}</Text>
          <Button onClick={onBack}>Retour</Button>
        </Stack>
      </Box>
    )
  }

  return (
    <Box position="fixed" inset="0" bg={THEMES.find((t) => t.theme === layout.theme)!.bg} css={{ ...HIDE_ZOOM_SLIDER, ...ABOVE_HOME_BAR }}>
      {/* Installed on iPhone the app draws under the status bar: keep the reader and its header out of it.
          At the bottom the page goes down to the edge, as in Photos (ABOVE_HOME_BAR). */}
      <Box ref={sheetRef} position="absolute" top="env(safe-area-inset-top)" bottom="0"
        left="env(safe-area-inset-left)" right="env(safe-area-inset-right)">
        <ReactReader
          reader={reader}
          enableFloatingProgress={false}
          settings={settings}
          onSettingsChange={(changes) => setSettings((old) => ({ ...old, ...changes }))}
          onItemClick={(item) => {
            if (item === 'back') onBack()
            if (item === 'more') setMenuOpen(true)
          }}
          slots={{ container: { props: { height: '100%', width: '100%', position: 'relative' } } }}
        >
          {/* The bands beside a narrow column are outside the book: a tap there turns the page too. */}
          <Box w="full" h="full" onClick={(e) => {
            const side = tapSide(e.clientX, innerWidth)
            if (reader && side && e.target === e.currentTarget) turnTowards(reader, side)
          }}>
            <Box ref={containerRef} w="full" maxW={columnWidth(layout.width)} mx="auto" h="full" />
          </Box>
          {/* Opaque while the book opens: the page frames are laid out, then painted, in several steps. */}
          <Box position="absolute" inset="0" display="grid" placeItems="center" pointerEvents="none"
            bg={THEMES.find((t) => t.theme === layout.theme)!.bg} opacity={reader && drawn === reader ? 0 : 1} transition="opacity 0.2s">
            <Loader />
          </Box>
          {/* The page number is in the menu: no floating percentage over the page. */}
          <Box position="absolute" left="2" bottom="calc(0.5rem + env(safe-area-inset-bottom))">
            <ZoomPageBar reader={reader} />
          </Box>
          {next && atEnd && !nextDismissed && reader && drawn === reader && (
            <NextVolume book={next} onClose={() => setNextDismissed(true)} />
          )}
        </ReactReader>
      </Box>
      {DEBUG && <DebugLog reader={reader} />}
      <ReaderSettings open={menuOpen} onClose={() => setMenuOpen(false)} layout={layout} onLayout={changeLayout}
        direction={direction} onDirection={changeDirection} />
    </Box>
  )
}

// On the last page of a volume, the next one of the series. Replaces the book in the history: back still
// leads to the series.
function NextVolume({ book, onClose }: { book: Book; onClose: () => void }) {
  return (
    <Flex position="absolute" insetX="4" bottom="calc(1rem + env(safe-area-inset-bottom))" mx="auto" maxW="sm" p="3" gap="3"
      align="center" bg="bg.panel" rounded="lg" shadow="lg" animationName="slide-from-bottom, fade-in" animationDuration="moderate">
      <Box w="10" flexShrink={0}><BookCover book={book} small /></Box>
      <Stack gap="0" flex="1" minW="0">
        <Text fontSize="xs" color="fg.muted">Tome suivant</Text>
        <Text fontSize="sm" fontWeight="semibold" lineClamp={2}>{book.title}</Text>
      </Stack>
      <Button size="sm" bg="white" color="black" fontWeight="bold" _hover={{ bg: 'whiteAlpha.800' }}
        onClick={() => location.replace(readHref(book))}>
        <LuPlay fill="currentColor" /> Lire
      </Button>
      <IconButton aria-label="Fermer" size="sm" variant="ghost" onClick={onClose}><LuX /></IconButton>
    </Flex>
  )
}

type SettingsProps = {
  open: boolean
  onClose: () => void
  layout: Layout
  onLayout: (changes: Partial<Layout>) => void
  direction?: Direction
  onDirection: (next: Direction) => void
}

export function ReaderSettings({ open, onClose, layout, onLayout, direction, onDirection }: SettingsProps) {
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
      <Stack gap="2" mb="6">
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
      </Stack>
      <Stack gap="2">
        <Text fontWeight="semibold">Sens de lecture</Text>
        <Button variant={direction === 'ltr' ? 'solid' : 'outline'} onClick={() => onDirection('ltr')}>
          Gauche → droite (livre)
        </Button>
        <Button variant={direction === 'rtl' ? 'solid' : 'outline'} onClick={() => onDirection('rtl')}>
          Droite → gauche (manga)
        </Button>
      </Stack>
    </Shell>
  )
}
