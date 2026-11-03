import { Box, Flex, Heading, IconButton } from '@chakra-ui/react'
import { Children, useRef, type ReactNode } from 'react'

// A Netflix row: scrolls sideways (snap on touch), arrows appear on hover with a mouse.
export function Row({ title, small, children }: { title: string; small?: boolean; children: ReactNode }) {
  const track = useRef<HTMLDivElement>(null)
  if (!Children.count(children)) return null
  const scroll = (dir: 1 | -1) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.9, behavior: 'smooth' })

  return (
    <Box as="section" position="relative" className="group" aria-label={title}>
      <Heading fontSize={{ base: 'md', md: 'xl' }} fontWeight="bold" mb="2" px={{ base: 4, md: 12 }}>{title}</Heading>
      <Flex ref={track} gap={{ base: 2, md: 3 }} overflowX="auto" px={{ base: 4, md: 12 }} py="2" scrollSnapType="x mandatory"
        scrollPaddingX={{ base: 4, md: 12 }} css={{ scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
        {Children.map(children, (child) => (
          <Box flex="0 0 auto" w={{ base: '28', md: small ? '32' : '40' }} scrollSnapAlign="start">{child}</Box>
        ))}
      </Flex>
      {([-1, 1] as const).map((dir) => (
        <IconButton key={dir} aria-label={dir < 0 ? 'Précédent' : 'Suivant'} onClick={() => scroll(dir)}
          position="absolute" top="9" bottom="8" {...(dir < 0 ? { left: 0 } : { right: 0 })} w="10" h="auto" rounded="none"
          bg="rgba(20,20,20,.6)" color="white" fontSize="3xl" opacity="0" hideBelow="md"
          _groupHover={{ opacity: 1 }} _focusVisible={{ opacity: 1 }}>
          {dir < 0 ? '‹' : '›'}
        </IconButton>
      ))}
    </Box>
  )
}
