import { Button, Flex, Text } from '@chakra-ui/react'
import { Shell } from './PinDialogs'

export type Confirm = { title: string; text: string; action: string; onOk: () => void }

// Replaces the browser's confirm(): the action button is the app's red.
export function ConfirmDialog({ title, text, action, onOk, onClose }: Confirm & { onClose: () => void }) {
  return (
    <Shell title={title} onClose={onClose} size="md">
      <Text color="muted">{text}</Text>
      <Flex gap="3" mt="6" justify="flex-end">
        <Button variant="ghost" color="white" onClick={onClose}>Annuler</Button>
        <Button bg="brand" color="white" onClick={() => { onClose(); onOk() }}>{action}</Button>
      </Flex>
    </Shell>
  )
}
