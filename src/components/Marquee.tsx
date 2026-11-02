import { chakra, Text, type TextProps } from '@chakra-ui/react'
import { useLayoutEffect, useRef, useState } from 'react'

// One line of text; when it is cut, it slides to its end after a pause, then back. Cut with "…" when
// the reader asked for reduced motion.
export function Marquee({ children, ...text }: TextProps) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [shift, setShift] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current!
    const measure = () => setShift(Math.max(0, el.scrollWidth - el.clientWidth))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [children])
  return (
    <Text ref={ref} overflow="hidden" whiteSpace="nowrap" css={{ '@media (prefers-reduced-motion: reduce)': { textOverflow: 'ellipsis' } }} {...text}>
      <chakra.span display="inline-block" style={{ '--shift': `-${shift}px` } as React.CSSProperties}
        animation={shift ? `marquee ${3 + shift / 25}s ease-in-out 1s infinite alternate` : undefined}
        css={{ '@media (prefers-reduced-motion: reduce)': { animation: 'none', display: 'inline' } }}>
        {children}
      </chakra.span>
    </Text>
  )
}
