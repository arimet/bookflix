import { Box } from '@chakra-ui/react'
import { DebugLog, DEBUG } from '../components/DebugLog'
import { Loader, OpenFailed } from '../components/Loader'
import { NextVolume } from '../components/NextVolume'
import { ZoomPageBar } from '../components/ZoomPageBar'
import { ReactReader, type ReactReaderSettings } from '@prose-reader/react-reader'
import '@prose-reader/react-reader/index.css'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AuthError } from '../dropbox/auth'
import type { Book } from '../library/library'
import { markSpineItemOnScreen, tapSide, turnOnEdgePulls, turnOnDoubleTapUnzoom, turnOnSideTaps, turnOnSwipeUpToClose, turnTowards, watchLastPage, whenPageOnScreenReady, type AppReader } from '../reader/createAppReader'
import { isComic, openReader } from '../reader/openReader'
import { cachedBookSettings, defaultDirection, loadBookSettings, setBookSetting, type BookSetting, type Direction, type Flow } from '../sync/books'
import { columnWidth, themeBg, useLayout } from './readerLayout'
import { ComicStrip } from './ComicStrip'
import { ReaderSettings } from './ReaderSettings'
import { positionRecorder } from '../sync/positionRecorder'
import { deviceName, flushPending, localProgress, recordProgress } from '../sync/progress'

const SETTINGS_KEY = 'bookflix.readerSettings'
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

// A comic read by scrolling down is shown by ComicStrip, prose-reader showing a page only once the scroll has
// stopped for half a second; every other book by prose-reader. onReopen opens the book again from scratch, after
// a change of direction or flow: the latest position is reread then.
export function ReaderScreen(props: Props) {
  const [opening, setOpening] = useState(0)
  const onReopen = useCallback(() => setOpening((n) => n + 1), [])
  const strip = isComic(props.book) && cachedBookSettings()[props.book.id]?.flow === 'scroll'
  return strip
    ? <ComicStrip key={`strip-${opening}`} {...props} onReopen={onReopen} />
    : <BookReader key={`book-${opening}`} {...props} onReopen={onReopen} />
}

function BookReader({ book, next, profileId, onBack, onError, onReopen }: Props & { onReopen: () => void }) {
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
  // How the book is read, as the reader opened it; scrollOnly for a book that asks for scrolling itself.
  const [flow, setFlow] = useState<{ flow: Flow; scrollOnly: boolean }>()
  const [failed, setFailed] = useState<string>() // the error, shown to tell what went wrong
  const [menuOpen, setMenuOpen] = useState(false)
  // One page at a time unless the reader picks two in the Layout menu.
  const [settings, setSettings] = useState<ReactReaderSettings>(() => ({ spreadMode: 'never', ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') }))
  const [layout, changeLayout] = useLayout()

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
    const unregisterDoubleTaps = turnOnDoubleTapUnzoom(reader)
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
      unregisterDoubleTaps()
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
      const { reader: instance, close, scrollOnly } = await openReader(book, dir, saved?.cfi ? { type: 'cfi', value: saved.cfi } : undefined,
        bookSettings[book.id]?.flow)
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
      setFlow({
        flow: instance.settings.values.computedPageTurnMode === 'scrollable' ? 'scroll' : 'pages',
        scrollOnly,
      })
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
  }, [bookId, rev, profileId, onError])

  const changeBook = async (changes: BookSetting) => {
    try {
      await setBookSetting(book.id, changes)
      onReopen()
    } catch (e) {
      onError(e)
    }
  }

  if (failed !== undefined) return <OpenFailed message={failed} onBack={onBack} />

  return (
    <Box position="fixed" inset="0" bg={themeBg(layout.theme)} css={{ ...HIDE_ZOOM_SLIDER, ...ABOVE_HOME_BAR }}>
      {/* Installed on iPhone the app draws under the status bar: keep the reader and its header out of it.
          At the bottom the page goes down to the edge, as in Photos (ABOVE_HOME_BAR). */}
      <Box ref={sheetRef} position="absolute" top="env(safe-area-inset-top)" bottom="0"
        left="env(safe-area-inset-left)" right="env(safe-area-inset-right)">
        <ReactReader
          reader={reader}
          enableFloatingProgress={false}
          // Scrolling, the browser zooms on a pinch (readerOptions): prose-reader must not zoom too.
          zoomMaxScale={flow?.flow === 'scroll' ? 1 : undefined}
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
            bg={themeBg(layout.theme)} opacity={reader && drawn === reader ? 0 : 1} transition="opacity 0.2s">
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
        direction={direction} flow={flow} onBook={changeBook} onReload={onReopen} />
    </Box>
  )
}

