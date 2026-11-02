import { Box, Button, Flex, Heading, Image, Stack, Text } from '@chakra-ui/react'
import { useRef } from 'react'
import type { Series } from '../library/catalog'
import type { Book } from '../library/library'
import { RED } from '../theme'
import { useCoverUrl } from './useCoverUrl'
import { useSoftBackdrop } from './useSoftBackdrop'
import { readHref, seriesHref } from '../routes'

type Props = { series: Series; book: Book; percent: number }

// The big poster: the book being read (or the newest series), its cover blown up behind.
export function Hero({ series, book, percent }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const cover = useCoverUrl(book, ref)
  const backdrop = useSoftBackdrop(cover)
  const volume = series.books.length > 1 ? `${book.title} · ` : ''

  return (
    <Box ref={ref} position="relative" h={{ base: '72vh', md: '80vh' }} minH="460px" overflow="hidden" isolation="isolate"
      bg="radial-gradient(ellipse at 70% 30%, #5a1418, #141414 70%)">
      {backdrop && (
        <Box position="absolute" inset="0" bgImage={`linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.45)), url(${backdrop})`}
          bgSize="cover" bgPos="center" />
      )}
      <Box position="absolute" inset="0" bg="linear-gradient(90deg, #141414 10%, rgba(20,20,20,.4) 55%, transparent), linear-gradient(0deg, #141414, transparent 40%)" />
      {cover && (
        // On a phone the top bar takes two lines: the cover starts below it.
        <Image src={cover} alt="" position="absolute" right={{ base: '50%', md: '12%' }}
          top={{ base: 'calc(env(safe-area-inset-top) + 7.5rem)', md: '16%' }}
          transform={{ base: 'translateX(50%)', md: 'none' }} h={{ base: '32%', md: '60%' }} rounded="sm" shadow="0 20px 60px #000" />
      )}
      <Flex position="absolute" inset="0" align="flex-end" px={{ base: 4, md: 12 }} pb={{ base: 10, md: 24 }}>
        <Stack gap="3" maxW={{ base: 'full', md: '45%' }}>
          <Heading fontSize={{ base: '3xl', md: '6xl' }} fontWeight="900" lineHeight="1" letterSpacing="-0.02em">{series.title}</Heading>
          <Text color="#46d369" fontWeight="bold" fontSize={{ base: 'sm', md: 'md' }}>
            {percent > 0 ? `${volume}${Math.round(percent * 100)} % lu` : `${series.books.length} ${series.books.length > 1 ? 'tomes' : 'livre'}`}
          </Text>
          {percent > 0 && (
            <Box h="1" w="64" maxW="full" bg="rgba(255,255,255,.3)"><Box h="full" w={`${percent * 100}%`} bg={RED} /></Box>
          )}
          <Flex gap="3" mt="2">
            <Button asChild bg="white" color="black" fontWeight="bold" size={{ base: 'md', md: 'lg' }} _hover={{ bg: 'whiteAlpha.800' }}>
              <a href={readHref(book)}>▶ {percent > 0 ? 'Reprendre' : 'Lire'}</a>
            </Button>
            <Button asChild bg="rgba(109,109,110,.7)" color="white" fontWeight="bold" size={{ base: 'md', md: 'lg' }}>
              <a href={seriesHref(series)}>ⓘ Détails</a>
            </Button>
          </Flex>
        </Stack>
      </Flex>
    </Box>
  )
}
