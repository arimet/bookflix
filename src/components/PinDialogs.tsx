import { Button, Dialog, Input, Portal, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { checkPin, setProfilePin, type Profile } from '../sync/profiles'

const PIN = /^\d{4}$/

function PinInput({ value, onChange, label, autoFocus }: { value: string; onChange: (v: string) => void; label: string; autoFocus?: boolean }) {
  return (
    <Input type="password" inputMode="numeric" autoComplete="off" maxLength={4} placeholder="••••" aria-label={label}
      autoFocus={autoFocus} textAlign="center" fontSize="2xl" letterSpacing="0.5em" bg="black"
      value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))} />
  )
}

export function Shell({ title, onClose, children, size = 'xs' }: { title: string; onClose: () => void; children: React.ReactNode; size?: 'xs' | 'md' }) {
  return (
    <Dialog.Root open onOpenChange={(e) => !e.open && onClose()} placement="center" size={size}>
      <Portal>
        <Dialog.Backdrop bg="rgba(0,0,0,.8)" />
        <Dialog.Positioner>
          <Dialog.Content bg="panel" color="white" mx="4">
            <Dialog.Header><Dialog.Title>{title}</Dialog.Title></Dialog.Header>
            <Dialog.Body pb="6">{children}</Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}

// Asked when picking a profile that has a code.
export function PinPrompt({ profile, onOk, onClose }: { profile: Profile; onOk: () => void; onClose: () => void }) {
  const [pin, setPin] = useState('')
  const [wrong, setWrong] = useState(false)
  const submit = async () => ((await checkPin(profile, pin)) ? onOk() : (setWrong(true), setPin('')))
  return (
    <Shell title={`Code de ${profile.name}`} onClose={onClose}>
      <Stack as="form" gap="4" onSubmit={(e) => { e.preventDefault(); submit() }}>
        <PinInput value={pin} onChange={(v) => { setPin(v); setWrong(false) }} label="Code PIN" autoFocus />
        {wrong && <Text color="brand" fontSize="sm">Code incorrect.</Text>}
        <Button type="submit" bg="brand" color="white" disabled={!PIN.test(pin)}>Ouvrir</Button>
      </Stack>
    </Shell>
  )
}

// Set, change or remove the code of the current profile; the current code is required to change it.
export function PinSettings({ profile, onDone, onClose, onError }: { profile: Profile; onDone: () => void; onClose: () => void; onError: (e: unknown) => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [wrong, setWrong] = useState(false)
  const save = async (pin: string | null) => {
    if (!(await checkPin(profile, current))) return setWrong(true)
    try {
      await setProfilePin(profile.id, pin)
      onDone()
    } catch (e) {
      onError(e)
    }
  }
  return (
    <Shell title="Code PIN du profil" onClose={onClose}>
      <Stack as="form" gap="4" onSubmit={(e) => { e.preventDefault(); save(next) }}>
        <Text fontSize="sm" color="muted">Demandé quand on choisit ce profil. Il sépare les lecteurs, ce n'est pas un mot de passe Dropbox.</Text>
        {profile.pinHash && (
          <>
            <Text fontSize="sm">Code actuel</Text>
            <PinInput value={current} onChange={(v) => { setCurrent(v); setWrong(false) }} label="Code actuel" autoFocus />
            {wrong && <Text color="brand" fontSize="sm">Code incorrect.</Text>}
          </>
        )}
        <Text fontSize="sm">Nouveau code (4 chiffres)</Text>
        <PinInput value={next} onChange={setNext} label="Nouveau code" autoFocus={!profile.pinHash} />
        <Button type="submit" bg="brand" color="white" disabled={!PIN.test(next) || (!!profile.pinHash && !PIN.test(current))}>Enregistrer</Button>
        {profile.pinHash && (
          <Button variant="ghost" color="muted" disabled={!PIN.test(current)} onClick={() => save(null)}>Supprimer le code</Button>
        )}
      </Stack>
    </Shell>
  )
}
