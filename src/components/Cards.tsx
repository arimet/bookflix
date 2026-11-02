import { Box, chakra, SimpleGrid, Text } from '@chakra-ui/react'
import type { Series } from '../library/catalog'
import type { Book } from '../library/library'
import { readHref, seriesHref } from '../routes'
import { BookCover } from './BookCover'
import { BookMenu } from './BookMenu'


const lift = { transition: 'transform .2s', _hover: { transform: 'scale(1.05)' }, _focusVisible: { transform: 'scale(1.05)' } }

// cover: the book whose cover stands for the series, its first one by default
export function SeriesCard({ series, cover = series.books[0] }: { series: Series; cover?: Book }) {
  return (
    <chakra.a href={seriesHref(series)} display="block" {...lift} aria-label={series.title}>
      <BookCover book={cover} label={series.title} />
      <Text fontSize="xs" color="muted" mt="1.5" lineClamp={1}>{series.title}</Text>
    </chakra.a>
  )
}

// label: "Boruto · Tome 02" when the book belongs to a series of several volumes
type BookCardProps = { book: Book; label: string; percent?: number; onReset?: () => void; onRemoveOffline?: () => void }

export function BookCard({ book, label, percent, onReset, onRemoveOffline }: BookCardProps) {
  return (
    <Box position="relative">
      <BookMenu title={label} onReset={onReset} onRemoveOffline={onRemoveOffline} button={{ top: '1.5', right: '1.5' }}>
        <chakra.a href={readHref(book)} display="block" {...lift} aria-label={label}>
          <BookCover book={book} label={label} percent={percent} />
          <Text fontSize="xs" color="muted" mt="1.5" lineClamp={1}>{label}</Text>
        </chakra.a>
      </BookMenu>
    </Box>
  )
}

// children: more cards after the series (books found by a search)
export function SeriesGrid({ series, children }: { series: Series[]; children?: React.ReactNode }) {
  return (
    <SimpleGrid columns={{ base: 3, sm: 4, md: 6, xl: 8 }} gap={{ base: 3, md: 4 }} rowGap="6">
      {series.map((s) => (
        <Box key={s.key}><SeriesCard series={s} /></Box>
      ))}
      {children}
    </SimpleGrid>
  )
}
