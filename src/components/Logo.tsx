import { Text, type TextProps } from '@chakra-ui/react'
import { RED } from '../theme'

export const Logo = (props: TextProps) => (
  <Text as="span" color={RED} fontWeight="900" letterSpacing="-0.04em" textTransform="uppercase" fontSize="2xl" {...props}>
    Bookflix
  </Text>
)
