import { Box, Text } from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import type { AppReader } from '../reader/createAppReader'
import { pageLabel } from '../reader/pageLabel'

// Replaces prose-reader's percentage, in the same corner and the same outlined lettering.
export function PageIndicator({ reader, chapters }: { reader?: AppReader; chapters: boolean }) {
  const [label, setLabel] = useState<string>()

  useEffect(() => {
    if (!reader) return
    const sub = reader.pagination.state$.subscribe((state) => setLabel(pageLabel(state, chapters)))
    return () => {
      sub.unsubscribe()
      setLabel(undefined)
    }
  }, [reader, chapters])

  if (!label) return null
  return (
    <Box position="absolute" right="0" bottom="0" p="2" pointerEvents="none" color="white" letterSpacing="1px"
      css={{ WebkitTextStroke: '2px black', paintOrder: 'stroke fill' }}>
      <Text fontSize="sm">{label}</Text>
    </Box>
  )
}
