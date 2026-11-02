import { Box, chakra, SimpleGrid, Text } from '@chakra-ui/react'
import type { Series } from '../library/catalog'
import type { Book } from '../library/library'
import { readHref, seriesHref } from '../routes'
import { BookCover } from './BookCover'
import { ResetMenu } from './ResetMenu'


const lift = { transition: 'transform .2s', _hover: { transform: 'scale(1.05)' }, _focusVisible: { transform: 'scale(1.05)' } }

export function SeriesCard({ series }: { series: Series }) {
  return (
    <chakra.a href={seriesHref(series)} display="block" {...lift} aria-label={series.title}>
      <BookCover book={series.books[0]} label={series.title} />
      <Text fontSize="xs" color="muted" mt="1.5" lineClamp={1}>{series.title}</Text>
    </chakra.a>
  )
}

// label: "Boruto · Tome 02" when the book belongs to a series of several volumes
export function BookCard({ book, label, percent, onReset }: { book: Book; label: string; percent?: number; onReset?: () => void }) {
  return (
    <Box position="relative">
      <chakra.a href={readHref(book)} display="block" {...lift} aria-label={label}>
        <BookCover book={book} label={label} percent={percent} />
        <Text fontSize="xs" color="muted" mt="1.5" lineClamp={1}>{label}</Text>
      </chakra.a>
      {onReset && <ResetMenu title={label} onReset={onReset} top="1.5" right="1.5" />}
    </Box>
  )
}

export function SeriesGrid({ series }: { series: Series[] }) {
  return (
    <SimpleGrid columns={{ base: 3, sm: 4, md: 6, xl: 8 }} gap={{ base: 3, md: 4 }} rowGap="6">
      {series.map((s) => (
        <Box key={s.key}><SeriesCard series={s} /></Box>
      ))}
    </SimpleGrid>
  )
}
