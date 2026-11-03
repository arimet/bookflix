import { Box } from '@chakra-ui/react'
import { useEffect, useRef, useState } from 'react'
import type { AppReader } from '../reader/createAppReader'

// With "?debug" in the address, the reader lists what it loads and unloads, and when the service worker
// reopens the book: a way to see what happens on a phone we cannot run here. The lines survive a reload,
// so what came just before Safari killed the page stays readable.
export const DEBUG = new URLSearchParams(location.search).has('debug')
const KEY = 'bookflix.debugLog'
const saved = (): string[] => JSON.parse(sessionStorage.getItem(KEY) ?? '[]')

export function DebugLog({ reader }: { reader?: AppReader }) {
  const [lines, setLines] = useState<string[]>(() => (saved().length ? [...saved(), '--- page rechargée ---'] : []))
  const start = useRef(performance.now())
  const add = (line: string) =>
    setLines((old) => {
      const next = [...old.slice(-21), `${((performance.now() - start.current) / 1000).toFixed(1)}s ${line}`]
      sessionStorage.setItem(KEY, JSON.stringify(next))
      return next
    })

  useEffect(() => {
    const onMessage = (e: MessageEvent) => e.data?.debug && add(`sw: ${e.data.debug}`)
    const onResize = () => add(`resize ${innerWidth}×${innerHeight}`)
    const onVisibility = () => add(`page ${document.visibilityState}`)
    navigator.serviceWorker?.addEventListener('message', onMessage)
    addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      navigator.serviceWorker?.removeEventListener('message', onMessage)
      removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  useEffect(() => {
    if (!reader) return
    add('reader ready')
    // The width shows how big each chapter frame is laid out (one screen width per page).
    const sub = reader.spineItemsObserver.itemLoadStatusChange$.subscribe(({ item }) =>
      add(`item ${item.index} ${item.value.loadStatus}${item.value.loadStatus === 'loaded' ? ` ${item.containerElement?.offsetWidth}px` : ''}`))
    return () => sub.unsubscribe()
  }, [reader])

  return (
    <Box position="fixed" left="0" right="0" bottom="0" zIndex="2000" pointerEvents="none" bg="rgba(0,0,0,.75)" color="#7CFC00"
      fontFamily="mono" fontSize="10px" lineHeight="1.3" p="2" whiteSpace="pre-wrap">
      {lines.join('\n')}
    </Box>
  )
}
