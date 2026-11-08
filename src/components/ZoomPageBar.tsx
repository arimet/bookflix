import { HStack, IconButton } from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import { LuChevronLeft, LuChevronRight, LuZoomOut } from 'react-icons/lu'
import { isZoomedIn, turnTowards, type AppReader } from '../reader/createAppReader'

// Zoomed in, a tap or a swipe moves around the page instead of turning it: these two buttons turn it,
// keeping the zoom, so a manga zoomed past its margins stays framed the same from page to page.
// Left and right like the side taps: on a manga read right to left, the left one goes forward.
// Scrolling down, there is no page to turn: one button leaves the zoom, a pinch the browser takes for a scroll
// being easy to miss on iPhone.
export function ZoomPageBar({ reader }: { reader?: AppReader }) {
  const [zoomed, setZoomed] = useState(false)

  useEffect(() => {
    if (!reader) return
    const sub = reader.zoom.state$.subscribe((state) => setZoomed(isZoomedIn(state)))
    return () => {
      sub.unsubscribe()
      setZoomed(false)
    }
  }, [reader])

  if (!reader || !zoomed) return null
  if (reader.settings.values.computedPageTurnMode === 'scrollable') {
    return (
      <HStack gap="1" p="0.5" bg="bg.panel" shadow="sm" borderRadius="md" animationName="fade-in" animationDuration="moderate">
        <IconButton aria-label="Dézoomer" variant="ghost" size="sm" onClick={() => reader.zoom.exit({ animate: true })}>
          <LuZoomOut />
        </IconButton>
      </HStack>
    )
  }
  return (
    <HStack gap="1" p="0.5" bg="bg.panel" shadow="sm" borderRadius="md"
      animationName="fade-in" animationDuration="moderate">
      <IconButton aria-label="Page de gauche" variant="ghost" size="sm" onClick={() => turnTowards(reader, 'left')}>
        <LuChevronLeft />
      </IconButton>
      <IconButton aria-label="Page de droite" variant="ghost" size="sm" onClick={() => turnTowards(reader, 'right')}>
        <LuChevronRight />
      </IconButton>
    </HStack>
  )
}
