import { Box, Button, Flex, IconButton, Stack, Text } from '@chakra-ui/react'
import { LuPlay, LuX } from 'react-icons/lu'
import type { Book } from '../library/library'
import { readHref } from '../routes'
import { BookCover } from './BookCover'

// On the last page of a volume, the next one of the series. Replaces the book in the history: back still
// leads to the series.
export function NextVolume({ book, onClose }: { book: Book; onClose: () => void }) {
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

