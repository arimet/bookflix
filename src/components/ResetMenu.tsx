import { IconButton, Menu } from '@chakra-ui/react'

// The "⋯" button on a book: for now its only action is to start the book over.
export function ResetMenu({ title, onReset, ...position }: { title: string; onReset: () => void; top?: string; right?: string }) {
  return (
    <Menu.Root onSelect={onReset} positioning={{ placement: 'bottom-end' }}>
      <Menu.Trigger asChild>
        <IconButton aria-label={`Actions pour ${title}`} size="xs" rounded="full" bg="rgba(20,20,20,.75)" color="white"
          position="absolute" zIndex="1" {...position}>⋯</IconButton>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content bg="rgba(0,0,0,.92)" color="white" borderColor="#333">
          <Menu.Item value="reset">Remettre à zéro</Menu.Item>
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  )
}
