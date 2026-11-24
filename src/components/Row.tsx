import { Box, chakra, Flex, Heading, IconButton } from '@chakra-ui/react'
import { AnimatePresence, motion } from 'motion/react'
import { Children, isValidElement, useRef, type ReactNode } from 'react'
import { foldInOut, popInOut } from './motion'

// A Netflix row: scrolls sideways (snap on touch), arrows appear on hover with a mouse.
// Books come and go with an animation; the row folds away with its last book. more: a page with all of them.
export function Row({ title, small, more, children }: { title: string; small?: boolean; more?: string; children: ReactNode }) {
  const track = useRef<HTMLDivElement>(null)
  const items = Children.toArray(children).filter(isValidElement)
  const scroll = (dir: 1 | -1) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.9, behavior: 'smooth' })

  return (
    <AnimatePresence initial={false}>
      {items.length > 0 && (
        <motion.section key="row" {...foldInOut} className="group" aria-label={title} style={{ position: 'relative' }}>
          <Flex align="baseline" gap="3" mb="2" px={{ base: 4, md: 12 }}>
            <Heading fontSize={{ base: 'md', md: 'xl' }} fontWeight="bold">{title}</Heading>
            {more && (
              <chakra.a href={more} fontSize={{ base: 'xs', md: 'sm' }} fontWeight="semibold" color="muted" _hover={{ color: 'white' }}>
                Tout voir ›
              </chakra.a>
            )}
          </Flex>
          <Flex ref={track} position="relative" gap={{ base: 2, md: 3 }} overflowX="auto" px={{ base: 4, md: 12 }} py="2" scrollSnapType="x mandatory"
            scrollPaddingX={{ base: 4, md: 12 }} css={{ scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
            <AnimatePresence mode="popLayout" initial={false}>
              {items.map((child) => (
                <motion.div key={child.key} {...popInOut} style={{ flex: '0 0 auto', scrollSnapAlign: 'start' }}>
                  <Box w={{ base: '28', md: small ? '32' : '40' }}>{child}</Box>
                </motion.div>
              ))}
            </AnimatePresence>
          </Flex>
          {([-1, 1] as const).map((dir) => (
            <IconButton key={dir} aria-label={dir < 0 ? 'Précédent' : 'Suivant'} onClick={() => scroll(dir)}
              position="absolute" top="9" bottom="8" {...(dir < 0 ? { left: 0 } : { right: 0 })} w="10" h="auto" rounded="none"
              bg="rgba(20,20,20,.6)" color="white" fontSize="3xl" opacity="0" hideBelow="md"
              _groupHover={{ opacity: 1 }} _focusVisible={{ opacity: 1 }}>
              {dir < 0 ? '‹' : '›'}
            </IconButton>
          ))}
        </motion.section>
      )}
    </AnimatePresence>
  )
}
