import { Box, Button, Flex, Heading, Image, Stack, Text } from '@chakra-ui/react'
import { useRef } from 'react'
import { LuInfo, LuPlay } from 'react-icons/lu'
import type { Series } from '../library/catalog'
import type { Book } from '../library/library'
import { RED } from '../theme'
import { useCoverUrl } from './useCoverUrl'
import { useSoftBackdrop } from './useSoftBackdrop'
import { readHref, seriesHref } from '../routes'

type Props = { series: Series; book: Book; percent: number }

const COVER_W = 'min(22vw, 300px)'
const COVER_END = 'max(0px, calc(50vw - 40rem))'
// What the first row below leaves free on the right for the cover, on a wide screen.
export const COVER_SPACE = `calc(3rem + ${COVER_END} + ${COVER_W} + 2rem)`

// "Naruto - Tome 01" under the "Naruto" title reads as "Tome 01".
const volumeName = (series: Series, book: Book) =>
  book.title.startsWith(series.title) ? book.title.slice(series.title.length).replace(/^[\s\-–—·:,]+/, '') || book.title : book.title

// The big poster: the book being read (or the newest series), its cover blurred across the whole width.
export function Hero({ series, book, percent }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const cover = useCoverUrl(book, ref)
  const { soft: backdrop, glow } = useSoftBackdrop(cover)
  const count = series.books.length
  const started = percent > 0

  return (
    <Box ref={ref} position="relative" h={{ base: '78vh', md: 'min(54vh, 540px)' }} minH={{ base: '560px', md: '380px' }} overflow={{ base: 'hidden', md: 'visible' }}
      bg="radial-gradient(ellipse at 70% 30%, #5a1418, #141414 70%)">
      {backdrop && (
        // Faded out at the bottom: its edge would otherwise show as a line on a fractional pixel.
        <Box position="absolute" inset="0" bgImage={`url(${backdrop})`} bgSize="cover" bgPos="center"
          css={{ maskImage: 'linear-gradient(0deg, transparent, black 30%)', WebkitMaskImage: 'linear-gradient(0deg, transparent, black 30%)' }} />
      )}
      {glow && (
        <Box position="absolute" inset="0" opacity=".9" mixBlendMode="screen"
          bg={{ base: `radial-gradient(ellipse 80% 45% at 50% 30%, ${glow}, transparent 70%)`, md: `radial-gradient(ellipse 65% 85% at 75% 40%, ${glow}, transparent 70%)` }} />
      )}
      {/* Darker on the text side and towards the rows below, the cover's colours kept on the right. */}
      <Box position="absolute" inset="0"
        bg={{
          base: 'linear-gradient(0deg, #141414 8%, rgba(20,20,20,.7) 45%, rgba(20,20,20,.35))',
          md: 'linear-gradient(90deg, #141414 5%, rgba(20,20,20,.7) 35%, rgba(20,20,20,.1) 70%), linear-gradient(0deg, #141414, transparent 35%), linear-gradient(180deg, rgba(20,20,20,.6), transparent 20%)',
        }} />
      <Flex position="absolute" inset="0" px={{ base: 4, md: 12 }}
        pt={{ base: 'calc(env(safe-area-inset-top) + 7rem)', md: '20' }} pb={{ base: 10, md: 24 }}
        direction={{ base: 'column', md: 'row-reverse' }} align={{ base: 'center', md: 'flex-end' }}
        justify={{ base: 'flex-end', md: 'space-between' }} gap={{ base: 6, md: 16 }}>
        {cover && (
          // The text stays in line with the rows below; on a wide screen the cover comes towards it and runs
          // down beside the first row, which leaves it that space (COVER_SPACE).
          <Image src={cover} alt="" flexShrink="1" minH="0" w={{ base: 'auto', md: COVER_W }} h="auto" maxH={{ base: '36vh', md: 'none' }}
            maxW={{ base: '60%', md: 'none' }} me={{ md: COVER_END }} alignSelf={{ md: 'flex-start' }} position="relative" zIndex="1"
            rounded="md" outline="1px solid rgba(255,255,255,.08)" outlineOffset="-1px"
            shadow="0 40px 80px -24px rgba(0,0,0,.9), 0 12px 32px rgba(0,0,0,.5)"
            animation="rise .7s cubic-bezier(.16,1,.3,1) both" css={{ '@media (prefers-reduced-motion: reduce)': { animation: 'none' } }} />
        )}
        <Stack gap={{ base: 3, md: 4 }} w="full" maxW={{ md: '36rem' }} textAlign={{ base: 'center', md: 'left' }} align={{ base: 'center', md: 'flex-start' }}>
          <Heading as="h1" fontSize={{ base: '4xl', md: '6xl', xl: '7xl' }} fontWeight="900" lineHeight=".95" letterSpacing="-0.03em"
            textWrap="balance" textShadow="0 2px 24px rgba(0,0,0,.5)">
            {series.title}
          </Heading>
          {started ? (
            <Flex align="center" gap="3" fontSize={{ base: 'sm', md: 'md' }}>
              <Box h="1" w={{ base: '24', md: '32' }} bg="rgba(255,255,255,.25)" rounded="full" overflow="hidden" flexShrink="0">
                <Box h="full" w={`${percent * 100}%`} bg={RED} />
              </Box>
              <Text color="white" fontWeight="semibold" whiteSpace="nowrap">{Math.round(percent * 100)} %</Text>
              {count > 1 && <Text color="muted" lineClamp={1}>{volumeName(series, book)}</Text>}
            </Flex>
          ) : (
            <Text color="muted" fontSize={{ base: 'sm', md: 'md' }}>{count} {count > 1 ? 'tomes' : 'livre'}</Text>
          )}
          <Flex gap="3" mt="2">
            <Button asChild bg="white" color="black" fontWeight="bold" size={{ base: 'md', md: 'lg' }} px={{ md: 7 }} _hover={{ bg: 'whiteAlpha.800' }}>
              <a href={readHref(book)}><LuPlay fill="currentColor" /> {started ? 'Reprendre' : 'Lire'}</a>
            </Button>
            <Button asChild bg="rgba(109,109,110,.6)" color="white" fontWeight="bold" size={{ base: 'md', md: 'lg' }} px={{ md: 7 }}
              _hover={{ bg: 'rgba(109,109,110,.45)' }}>
              <a href={seriesHref(series)}><LuInfo /> Détails</a>
            </Button>
          </Flex>
        </Stack>
      </Flex>
    </Box>
  )
}
