import { Box, Flex, Stack } from '@chakra-ui/react'

// Netflix's turning red ring (styles in theme.ts).
export const Loader = ({ small }: { small?: boolean }) => (
  <Box className="bf-loader" role="status" aria-label="Chargement" {...(small && { w: '6', h: '6' })} />
)

export const FullLoader = () => <Box minH="100dvh" display="grid" placeItems="center"><Loader /></Box>

// The home page drawn in grey while the library loads: a hero, then rows of covers.
export function LibrarySkeleton() {
  return (
    <Box pb="16" overflow="hidden" role="status" aria-label="Chargement de la bibliothèque">
      <Box h={{ base: '78vh', md: '82vh' }} minH={{ base: '560px', md: '520px' }} bg="linear-gradient(0deg, #141414, #1c1c1c)" />
      <Stack gap={{ base: 6, md: 10 }} mt={{ base: -6, md: -16 }} position="relative">
        {[0, 1, 2].map((row) => (
          <Box key={row} px={{ base: 4, md: 12 }}>
            <Box className="bf-shimmer" h="4" w="40" rounded="sm" mb="4" />
            <Flex gap={{ base: 2, md: 3 }}>
              {Array.from({ length: 8 }, (_, i) => (
                <Box key={i} className="bf-shimmer" flex="0 0 auto" w={{ base: '28', md: '40' }} aspectRatio={2 / 3} rounded="sm" />
              ))}
            </Flex>
          </Box>
        ))}
      </Stack>
    </Box>
  )
}
