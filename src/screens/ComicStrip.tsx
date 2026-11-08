import { Box, Flex, IconButton, Text } from '@chakra-ui/react'
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { LuChevronLeft, LuSettings } from 'react-icons/lu'
import { firstValueFrom } from 'rxjs'
import { Loader, OpenFailed } from '../components/Loader'
import { NextVolume } from '../components/NextVolume'
import { AuthError } from '../dropbox/auth'
import type { Book } from '../library/library'
import { pageAt, pageCfi, pageOfCfi, stripPercent } from '../reader/comicStrip'
import { isDoubleTap, isPageZoomed, resetPageZoom } from '../reader/pageZoom'
import { openComic } from '../reader/openReader'
import { cachedBookSettings, defaultDirection, setBookSetting, type BookSetting, type Direction } from '../sync/books'
import { deviceName, flushPending, localProgress, recordProgress } from '../sync/progress'
import { columnWidth, themeBg, useLayout } from './readerLayout'
import { ReaderSettings } from './ReaderSettings'

// Pages are fetched when they come within AHEAD of the screen, and let go past BEHIND: a comic page is a big image.
const AHEAD = '250%'
const BEHIND = '350%'
const FLUSH_DELAY = 5000

type Page = { id: string; href: string }
type Comic = {
  pages: Page[]
  fetchPage: (page: Page) => Promise<string> // an object URL of the image
  start: number // the page to open at
  ratio: number // width / height of the pages not loaded yet: the first page opened gives it
  direction: Direction
}

const imageRatio = (url: string) =>
  new Promise<number>((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image.naturalWidth / image.naturalHeight || 2 / 3)
    image.onerror = () => resolve(2 / 3)
    image.src = url
  })

type Props = { book: Book; next?: Book; profileId: string; onBack: () => void; onError: (e: unknown) => void; onReopen: () => void }

// A comic read by scrolling down: its pages one under the other, each the width of the column and the height of its
// image, in a plain scrolling box. The browser scrolls and zooms; pages are fetched ahead as the scroll goes.
export function ComicStrip({ book, next, profileId, onBack, onError, onReopen }: Props) {
  const [layout, changeLayout] = useLayout()
  const [comic, setComic] = useState<Comic>()
  const [failed, setFailed] = useState<string>()
  const [urls, setUrls] = useState<Record<number, string>>({})
  const [page, setPage] = useState(0)
  const [atEnd, setAtEnd] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [nextDismissed, setNextDismissed] = useState(false)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const pageEls = useRef<HTMLDivElement[]>([])
  const ratios = useRef<Record<number, number>>({}) // width / height of the pages seen
  const urlsRef = useRef<Record<number, string>>({}) // the same as urls, read at once
  const fetching = useRef(new Set<number>())
  const farAway = useRef(new Set<number>())

  // The App rebuilds the book object whenever the file list refreshes; only a new id or rev is another book.
  const bookRef = useRef(book)
  useLayoutEffect(() => {
    bookRef.current = book
  })
  const bookId = book.id
  const rev = book.file.rev

  useEffect(() => {
    const book = bookRef.current
    let cancelled = false
    let close = () => {}
    ;(async () => {
      const direction = cachedBookSettings()[book.id]?.direction ?? defaultDirection(book.format)
      const opened = await openComic(book, direction)
      close = opened.close
      if (cancelled) return close()
      const pages = opened.manifest.spineItems.map(({ id, href }) => ({ id, href }))
      if (!pages.length) throw new Error('Aucune page dans ce livre.')
      const fetchPage = async (page: Page) => URL.createObjectURL(await (await firstValueFrom(opened.getResource(page))).blob())
      const start = pageOfCfi(localProgress(profileId)[book.id]?.cfi, pages.length)
      const first = await fetchPage(pages[start])
      const ratio = await imageRatio(first)
      if (cancelled) return URL.revokeObjectURL(first)
      ratios.current[start] = ratio
      urlsRef.current = { [start]: first }
      setUrls(urlsRef.current)
      setPage(start)
      setComic({ pages, fetchPage, start, ratio, direction })
    })().catch((e) => {
      if (cancelled) return
      console.error(e)
      setFailed(e instanceof Error ? e.message : String(e))
      if (e instanceof AuthError) onError(e)
    })
    return () => {
      cancelled = true
      close()
      Object.values(urlsRef.current).forEach((url) => URL.revokeObjectURL(url))
      urlsRef.current = {}
    }
  }, [bookId, rev, profileId, onError])

  // Opens at the page last read.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    if (comic && scroller) scroller.scrollTop = pageEls.current[comic.start]?.offsetTop ?? 0
  }, [comic])

  // Fetches the pages coming near the screen, lets go of the ones far behind or ahead.
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!comic || !scroller) return
    const indexOf = (entry: IntersectionObserverEntry) => Number((entry.target as HTMLElement).dataset.index)
    const show = (index: number, url: string) => {
      urlsRef.current = { ...urlsRef.current, [index]: url }
      setUrls(urlsRef.current)
    }
    const drop = (index: number) => {
      const { [index]: url, ...others } = urlsRef.current
      if (!url) return
      URL.revokeObjectURL(url)
      urlsRef.current = others
      setUrls(others)
    }
    const near = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const index = indexOf(entry)
        if (!entry.isIntersecting || urlsRef.current[index] || fetching.current.has(index)) continue
        fetching.current.add(index)
        comic.fetchPage(comic.pages[index]).then((url) => {
          if (farAway.current.has(index) || !scrollerRef.current) URL.revokeObjectURL(url)
          else show(index, url)
        }, (e) => console.warn('Page not loaded', index, e)).finally(() => fetching.current.delete(index))
      }
    }, { root: scroller, rootMargin: `${AHEAD} 0px` })
    const far = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const index = indexOf(entry)
        if (entry.isIntersecting) farAway.current.delete(index)
        else {
          farAway.current.add(index)
          drop(index)
        }
      }
    }, { root: scroller, rootMargin: `${BEHIND} 0px` })
    pageEls.current.forEach((element) => {
      near.observe(element)
      far.observe(element)
    })
    return () => {
      near.disconnect()
      far.disconnect()
    }
  }, [comic])

  // A page seen for the first time takes the shape of its image; one above the screen keeps what is on screen in place.
  const fit = useCallback((index: number, image: HTMLImageElement) => {
    const box = pageEls.current[index]
    const scroller = scrollerRef.current
    const ratio = image.naturalWidth / image.naturalHeight
    if (!box || !scroller || !ratio || ratios.current[index] === ratio) return
    const before = box.offsetHeight
    ratios.current[index] = ratio
    box.style.aspectRatio = String(ratio)
    if (box.offsetTop < scroller.scrollTop) scroller.scrollTop += box.offsetHeight - before
  }, [])

  // The page at the top third of the screen is the one being read; looked at once per frame at most.
  const frame = useRef(0)
  const onScroll = useCallback(() => {
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      const scroller = scrollerRef.current
      if (!scroller) return
      const tops = pageEls.current.map((element) => element.offsetTop)
      setPage(pageAt(tops, scroller.scrollTop + scroller.clientHeight / 3))
      setAtEnd(scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4)
    })
  }, [])
  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  // Records where the reader is, as prose-reader would; the position the book opened at is not reading.
  const recorded = useRef<string>(undefined)
  useEffect(() => {
    if (!comic) return
    const at = `${page}:${atEnd}`
    if (recorded.current === undefined) recorded.current = `${comic.start}:false`
    if (recorded.current === at) return
    recorded.current = at
    recordProgress(profileId, bookId, {
      cfi: pageCfi(page, comic.pages[page].id),
      percent: stripPercent(page, comic.pages.length, atEnd),
      updatedAt: Date.now(),
      device: deviceName(),
    })
    const timer = setTimeout(() => flushPending(profileId).catch(() => {}), FLUSH_DELAY)
    return () => clearTimeout(timer)
  }, [comic, page, atEnd, profileId, bookId])

  useEffect(() => {
    const flush = () => flushPending(profileId).catch(() => {}) // stays pending, retried on reconnect
    const onVisibility = () => document.visibilityState === 'hidden' && flush()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      flush()
    }
  }, [profileId])

  // A tap shows or hides the menu. A double tap on a zoomed page puts the zoom back too, the menu left as it was
  // before. touchAction keeps the browser from zooming on a double tap itself.
  const lastTap = useRef<{ time: number; x: number; y: number }>(undefined)
  const onTap = (event: React.MouseEvent) => {
    const tap = { time: Date.now(), x: event.clientX, y: event.clientY }
    const double = isDoubleTap(lastTap.current, tap)
    lastTap.current = double ? undefined : tap
    if (double && isPageZoomed()) resetPageZoom()
    setMenuOpen((open) => !open) // on a double tap, undoes the first tap's
  }

  const changeBook = async (changes: BookSetting) => {
    try {
      await setBookSetting(bookId, changes)
      onReopen()
    } catch (e) {
      onError(e)
    }
  }

  if (failed !== undefined) return <OpenFailed message={failed} onBack={onBack} />

  const bg = themeBg(layout.theme)
  return (
    <Box position="fixed" inset="0" bg={bg}>
      <Box ref={scrollerRef} position="absolute" top="env(safe-area-inset-top)" bottom="0" left="0" right="0"
        overflowY="auto" overflowX="hidden" overflowAnchor="none" touchAction="pan-x pan-y pinch-zoom" onScroll={onScroll} onClick={onTap}>
        <Box maxW={columnWidth(layout.width)} mx="auto" pb="env(safe-area-inset-bottom)">
          {comic?.pages.map((p, index) => (
            <StripPage key={p.id} index={index} url={urls[index]} ratio={ratios.current[index] ?? comic.ratio} onFit={fit}
              register={(element) => { if (element) pageEls.current[index] = element }} />
          ))}
        </Box>
      </Box>
      {!comic && <Box position="absolute" inset="0" display="grid" placeItems="center"><Loader /></Box>}
      {menuOpen && (
        <Flex position="absolute" top="0" insetX="0" pt="env(safe-area-inset-top)" bg="bg.panel" shadow="md" align="center" gap="2" px="2" h="calc(3.5rem + env(safe-area-inset-top))"
          animationName="slide-from-top, fade-in" animationDuration="moderate">
          <IconButton aria-label="Retour" variant="ghost" onClick={onBack}><LuChevronLeft /></IconButton>
          <Box flex="1" minW="0" textAlign="center">
            <Text truncate>{book.title}</Text>
            {comic && <Text fontSize="xs" color="fg.muted">{page + 1} / {comic.pages.length}</Text>}
          </Box>
          <IconButton aria-label="Réglages" variant="ghost" onClick={() => setSettingsOpen(true)}><LuSettings /></IconButton>
        </Flex>
      )}
      {next && atEnd && !nextDismissed && <NextVolume book={next} onClose={() => setNextDismissed(true)} />}
      <ReaderSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} layout={layout} onLayout={changeLayout}
        direction={comic?.direction} flow={{ flow: 'scroll', scrollOnly: false }} onBook={changeBook} text={false} onReload={onReopen} />
    </Box>
  )
}

type PageProps = { index: number; url?: string; ratio: number; onFit: (index: number, image: HTMLImageElement) => void; register: (element: HTMLDivElement | null) => void }

// A page: a box of the page's shape (until its image is in, the shape of the first page opened), the image in it.
const StripPage = memo(function StripPage({ index, url, ratio, onFit, register }: PageProps) {
  return (
    <div ref={register} data-index={index} style={{ aspectRatio: String(ratio), position: 'relative' }}>
      {url && <img src={url} alt="" draggable={false} onLoad={(e) => onFit(index, e.currentTarget)}
        style={{ display: 'block', width: '100%', height: '100%' }} />}
    </div>
  )
}, (before, after) => before.url === after.url && before.ratio === after.ratio)
