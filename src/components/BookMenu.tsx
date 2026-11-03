import { IconButton, Menu, Portal } from '@chakra-ui/react'
import { useRef, useState } from 'react'
import { ConfirmDialog } from './ConfirmDialog'

type Props = {
  title: string
  onReset?: () => void // for a started book
  onDownload?: () => void // for a book not on this device
  onRemoveOffline?: () => void // for a book downloaded on this device
  children: React.ReactElement // a long press (touch) or a right click on it opens the menu
  button?: { top: string; right: string } // where to put the "⋯" button, if any
}

// The actions on a book, from its "⋯" button or a long press. Starting over asks first.
export function BookMenu({ title, onReset, onDownload, onRemoveOffline, children, button }: Props) {
  const [asking, setAsking] = useState(false)
  const open = useRef(false)
  if (!onReset && !onDownload && !onRemoveOffline) return children
  const onSelect = ({ value }: { value: string }) => (value === 'reset' ? setAsking(true) : value === 'download' ? onDownload?.() : onRemoveOffline?.())
  const content = (
    <Portal>
      <Menu.Positioner>
        <Menu.Content bg="rgba(0,0,0,.92)" color="white" borderColor="#333">
          {onReset && <Menu.Item value="reset">Remettre à zéro</Menu.Item>}
          {onDownload && <Menu.Item value="download">Télécharger sur l'appareil</Menu.Item>}
          {onRemoveOffline && <Menu.Item value="offline">Supprimer de l'appareil</Menu.Item>}
        </Menu.Content>
      </Menu.Positioner>
    </Portal>
  )
  return (
    <>
      <Menu.Root positioning={{ placement: 'bottom-end' }} onOpenChange={(e) => (open.current = e.open)} onSelect={onSelect}>
        {/* Lifting the finger after a long press must not follow the link underneath. */}
        <Menu.ContextTrigger asChild onClickCapture={(e) => open.current && e.preventDefault()}>{children}</Menu.ContextTrigger>
        {content}
      </Menu.Root>
      {/* A menu of its own: zag never places a menu opened from its button when it also has a context trigger. */}
      {button && (
        <Menu.Root positioning={{ placement: 'bottom-end' }} onSelect={onSelect}>
          <Menu.Trigger asChild>
            <IconButton aria-label={`Actions pour ${title}`} size="xs" rounded="full" bg="rgba(20,20,20,.75)" color="white"
              position="absolute" zIndex="1" {...button}>⋯</IconButton>
          </Menu.Trigger>
          {content}
        </Menu.Root>
      )}
      {asking && onReset && (
        <ConfirmDialog title="Remettre à zéro ?" text={`« ${title} » repartira du début sur tous tes appareils.`}
          action="Remettre à zéro" onOk={onReset} onClose={() => setAsking(false)} />
      )}
    </>
  )
}
