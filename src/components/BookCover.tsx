import { Box, Image, Text } from '@chakra-ui/react'
import { useRef } from 'react'
import type { Book } from '../library/library'
import { RED } from '../theme'
import { useCoverUrl } from './useCoverUrl'

// small: thumbnails too narrow for a title on the placeholder
type Props = { book: Book; label?: string; percent?: number; small?: boolean }

export function BookCover({ book, label, percent, small }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const url = useCoverUrl(book, ref)
  return (
    <Box ref={ref} aspectRatio={2 / 3} rounded="sm" overflow="hidden" position="relative"
      bg="linear-gradient(160deg, #2f2f2f, #1a1a1a)">
      {url ? (
        <Image src={url} alt="" w="full" h="full" objectFit="cover" />
      ) : (
        !small && <Text p="3" fontSize="sm" fontWeight="bold" lineClamp={5}>{label ?? book.title}</Text>
      )}
      {percent !== undefined && percent > 0 && (
        <Box position="absolute" insetX="0" bottom="0" h="1" bg="rgba(255,255,255,.3)">
          <Box h="full" w={`${Math.min(100, percent * 100)}%`} bg={RED} />
        </Box>
      )}
    </Box>
  )
}
