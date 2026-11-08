import { Button, Stack, Text } from '@chakra-ui/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LIBRARY_ROOT, type DropboxApp } from './config'
import { listLibrary, type LibraryListing } from './dropbox/api'
import { AuthError, isLoggedIn, loginErrorFromUrl, logout } from './dropbox/auth'
import { completeLogin, startConnection } from './dropbox/loginChain'
import { FullLoader, RetryScreen } from './components/Loader'
import { SeriesModal } from './components/SeriesModal'
import { AvatarDialog } from './components/AvatarDialog'
import { ConfirmDialog, type Confirm } from './components/ConfirmDialog'
import { PinSettings } from './components/PinDialogs'
import { TopBar, type ProfileAction } from './components/TopBar'
import { buildSeries, findSeries, nextInSeries, seriesOfBook } from './library/catalog'
import { allBooks, buildTree, type Book } from './library/library'
import { listOffline, removeOffline, saveOffline } from './offline/offline'
import { reloadIfUpdated } from './update'
import { parseHash, seriesHref, type Route } from './routes'
import { HistoryScreen, HomeScreen, KindScreen, SearchScreen } from './screens/BrowseScreens'
import { RequestsScreen } from './screens/RequestsScreen'
import { addRequest, availableMatches, loadRequests, removeRequest, updateRequest, type BookRequest } from './requests/requests'
import { LoginScreen } from './screens/LoginScreen'
import { ProfilesScreen } from './screens/ProfilesScreen'
import { ReaderScreen } from './screens/ReaderScreen'
import { cachedLibraryRoot, folderName, forgetLibraryRoot, isMissingFolder, resolveLibraryRoot, saveLibraryRoot } from './sync/libraryRoot'
import { FolderPicker } from './screens/FolderPicker'
import { Shell } from './components/PinDialogs'
import { folderAccess, getCurrentProfileId, loadProfiles, setCurrentProfileId, updateProfile, type Profile } from './sync/profiles'
import { deviceName, flushPending, loadProgress, localProgress, resetProgress, type ProgressMap } from './sync/progress'

// Screens a series sheet can open over; the sheet and the reader are not.
type BaseRoute = Extract<Route, { name: 'home' | 'kind' | 'search' | 'history' | 'requests' }>
const isBase = (r: Route): r is BaseRoute => ['home', 'kind', 'search', 'history', 'requests'].includes(r.name)
const BASE_HASHES = { home: '#/', search: '#/recherche', history: '#/historique', requests: '#/demandes' }
const baseHash = (r: BaseRoute) => (r.name === 'kind' ? (r.kind === 'comics' ? '#/bd' : '#/livres') : BASE_HASHES[r.name])

const LIBRARY_KEY = 'bookflix.library'
// A listing cached before folders could be chosen was of the default folder.
const cachedLibrary = (): LibraryListing | null => {
  const listing = JSON.parse(localStorage.getItem(LIBRARY_KEY) ?? 'null')
  return listing && { root: LIBRARY_ROOT, ...listing }
}
const connectedApps = () => ({ library: isLoggedIn('library'), sync: isLoggedIn('sync') })

export default function App() {
  const [connected, setConnected] = useState<Record<DropboxApp, boolean>>(connectedApps)
  const [profileId, setProfileId] = useState(getCurrentProfileId)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [library, setLibrary] = useState(cachedLibrary)
  const [progress, setProgress] = useState<ProgressMap>(() => (profileId ? localProgress(profileId) : {}))
  const [offline, setOffline] = useState<Set<string>>(new Set())
  const [route, setRoute] = useState(() => parseHash(location.hash))
  const [base, setBase] = useState<BaseRoute>(() => (isBase(route) ? route : { name: 'home' }))
  const [query, setQuery] = useState('')
  const [confirming, setConfirming] = useState<Confirm | null>(null)
  // Once the user has navigated inside the app, "back" can simply go back in history.
  const navigatedInApp = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)
  // A Dropbox code is being exchanged: no login button flashes between the two Dropbox screens.
  const [connecting, setConnecting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [pinOpen, setPinOpen] = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)
  // The household's books folder: null until known (first run), then picked or found (libraryRoot.ts).
  const [libraryRoot, setLibraryRoot] = useState(cachedLibraryRoot)
  const [picking, setPicking] = useState<{ message?: string; cancellable: boolean } | null>(null)
  const [adminOnly, setAdminOnly] = useState(false)
  // Finding the folder failed (Dropbox busy, unreadable settings): the start screen offers to try again.
  const [rootError, setRootError] = useState<string | null>(null)
  const [rootAttempt, setRootAttempt] = useState(0)
  const [requests, setRequests] = useState<BookRequest[] | null>(null)
  // Books being downloaded, with the share done: kept here so leaving the series sheet does not lose it.
  const [downloads, setDownloads] = useState<Record<string, number>>({})
  const inFlight = useRef(new Set<string>()) // the same, read synchronously: a second tap must not start it twice

  const onError = useCallback((e: unknown) => {
    console.error(e)
    if (e instanceof AuthError) setConnected(connectedApps())
    else setError(e instanceof TypeError ? 'Pas de connexion réseau.' : String((e as Error)?.message ?? e))
  }, [])

  // Back from Dropbox: finish this app, then go straight on to the other one (see loginChain).
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const code = params.get('code')
    const app = params.get('state') as DropboxApp | null
    const refused = loginErrorFromUrl(params)
    if (!refused && (!code || (app !== 'library' && app !== 'sync'))) return
    history.replaceState(null, '', location.pathname + location.hash)
    if (refused) return setLoginError(refused.message)
    setConnecting(true)
    completeLogin(app!, code!, 'redirect').then(
      (step) => {
        // 'next' leaves for Dropbox again: the loader stays until the page goes.
        if (step === 'next') return startConnection('redirect')
        setConnected(connectedApps())
        setConnecting(false)
      },
    ).catch((e) => {
      setConnected(connectedApps())
      setConnecting(false)
      if (e instanceof AuthError) onError(e)
      else setLoginError((e as Error).message)
    })
  }, [onError])

  useEffect(() => {
    const onHash = () => {
      navigatedInApp.current = true
      if (!inFlight.current.size) reloadIfUpdated()
      const next = parseHash(location.hash)
      setRoute(next)
      if (isBase(next)) setBase(next)
    }
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [])

  const loggedIn = connected.library && connected.sync
  const ready = loggedIn && !!profileId && libraryRoot !== null

  // Read again at every start: the folder known here gives an instant start, but the admin may have
  // changed it from another device since.
  useEffect(() => {
    if (!loggedIn) return
    const known = cachedLibraryRoot()
    setRootError(null)
    resolveLibraryRoot().then((found) => {
      if (!('root' in found)) return setPicking({ cancellable: false })
      if (known !== null && found.root !== known) {
        localStorage.removeItem(LIBRARY_KEY)
        setLibrary(null)
      }
      setLibraryRoot(found.root)
    }, (e) => {
      // With a folder known here the app goes on with it; without, nothing to show but the error.
      if (known === null && !(e instanceof AuthError)) setRootError(e instanceof SyntaxError ? 'Les réglages Bookflix de ton Dropbox sont illisibles.' : 'Dropbox ne répond pas pour le moment.')
      else onError(e)
    })
  }, [loggedIn, rootAttempt, onError])

  useEffect(() => {
    if (!ready) return
    loadProfiles().then(setProfiles, onError)
    listOffline().then(setOffline, onError)
    // The cached listing shows at once; Dropbox then only sends what changed since.
    listLibrary(libraryRoot, cachedLibrary() ?? undefined).then((listing) => {
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(listing))
      setLibrary(listing)
    }, (e) => {
      if (isMissingFolder(e)) setPicking({ message: `Le dossier ${folderName(libraryRoot)} n'existe plus dans ton Dropbox.`, cancellable: false })
      else if (!(e instanceof TypeError)) onError(e)
    })
    const flush = () => flushPending(profileId).catch((e) => (e instanceof TypeError ? undefined : onError(e)))
    flush()
    addEventListener('online', flush)
    return () => removeEventListener('online', flush)
  }, [ready, profileId, libraryRoot, onError])

  // Reload progress whenever we land on a folder, e.g. coming back from the reader.
  useEffect(() => {
    if (ready && route.name !== 'read') loadProgress(profileId).then(setProgress, onError)
  }, [ready, profileId, route.name, onError])

  const goBack = (fallback: string) => (navigatedInApp.current ? history.back() : (location.hash = fallback))

  const tree = useMemo(() => {
    if (!library) return null
    const all = buildTree(library.files, library.root)
    if (navigator.onLine) return all
    return buildTree(allBooks(all).filter((b) => offline.has(b.id)).map((b) => b.file), library.root)
  }, [library, offline])

  const pickProfile = (id: string | null) => {
    setCurrentProfileId(id)
    setProfileId(id)
    setProgress(id ? localProgress(id) : {})
  }

  const toggleOffline = async (book: Book) => {
    if (inFlight.current.has(book.id)) return
    inFlight.current.add(book.id)
    try {
      if (offline.has(book.id)) await removeOffline(book)
      else {
        setDownloads((d) => ({ ...d, [book.id]: 0 }))
        setNotice(`Téléchargement de « ${book.title} »…`)
        // One update per percent: progress events come for every network chunk.
        await saveOffline(book, (share) =>
          setDownloads((d) => (Math.floor(share * 100) === Math.floor((d[book.id] ?? 0) * 100) ? d : { ...d, [book.id]: share })))
        setNotice(`« ${book.title} » est sur l'appareil.`)
      }
      setOffline(await listOffline())
    } catch (e) {
      setNotice(null)
      onError((e as Error)?.name === 'QuotaExceededError' ? new Error(`Plus assez de place sur l'appareil pour « ${book.title} ».`) : e)
    } finally {
      inFlight.current.delete(book.id)
      setDownloads(({ [book.id]: _, ...others }) => others)
    }
  }

  // Lists the books folder from scratch (no cursor), then profiles, progress and downloads.
  const reload = async () => {
    if (!profileId || libraryRoot === null) return
    setNotice('Rechargement…')
    try {
      const listing = await listLibrary(libraryRoot)
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(listing))
      setLibrary(listing)
      setProfiles(await loadProfiles())
      await flushPending(profileId)
      setProgress(await loadProgress(profileId))
      setOffline(await listOffline())
      setNotice('Bibliothèque à jour.')
    } catch (e) {
      setNotice(null)
      if (isMissingFolder(e)) setPicking({ message: `Le dossier ${folderName(libraryRoot)} n'existe plus dans ton Dropbox.`, cancellable: false })
      else onError(e)
    }
  }

  const signOut = () => setConfirming({ title: 'Se déconnecter ?', text: 'Dropbox sera déconnecté sur cet appareil.', action: 'Se déconnecter', onOk: () => {
    logout('library')
    logout('sync')
    localStorage.removeItem(LIBRARY_KEY)
    setLibrary(null)
    forgetLibraryRoot()
    setLibraryRoot(null)
    pickProfile(null)
    setConnected(connectedApps())
  } })

  const resetBook = (book: Book) => {
    if (!profileId) return // confirmed in BookMenu
    resetProgress(profileId, book.id, deviceName())
    setProgress(localProgress(profileId))
    flushPending(profileId).catch(() => {}) // stays pending, retried on reconnect
  }

  // Short confirmations fade out; "…" notices stay until replaced.
  useEffect(() => {
    if (!notice || notice.endsWith('…')) return
    const timer = setTimeout(() => setNotice(null), 3000)
    return () => clearTimeout(timer)
  }, [notice])

  // A new folder: the old listing and its cursor are of no use, the load effect lists the new one.
  const pickFolder = (root: string) => {
    // The same folder again (e.g. recreated after it vanished): nothing changes but the listing, read afresh.
    if (root === libraryRoot) {
      setPicking(null)
      return reload()
    }
    return saveLibraryRoot(root).then(() => {
      localStorage.removeItem(LIBRARY_KEY)
      setLibrary(null)
      setLibraryRoot(root)
      setPicking(null)
    }, onError)
  }

  const becomeAdmin = (profile: Profile, then?: () => void) => setConfirming({
    title: 'Devenir admin ?', text: `${profile.name} suivra les demandes de tous les profils. Pense à lui mettre un code PIN.`,
    action: 'Devenir admin', onOk: () => updateProfile(profile.id, { admin: true }).then(loadProfiles).then((p) => { setProfiles(p); then?.() }, onError),
  })

  const changeFolder = () => {
    if (!profile) return
    const access = folderAccess(profile, profiles)
    if (access === 'change') setPicking({ cancellable: true })
    if (access === 'ask-admin') setAdminOnly(true)
    if (access === 'become-admin') becomeAdmin(profile, () => setPicking({ cancellable: true }))
  }

  const onProfileAction = (action: ProfileAction) => {
    if (action === 'folder') changeFolder()
    if (action === 'history') location.hash = '#/historique'
    if (action === 'reload') reload()
    if (action === 'pin') setPinOpen(true)
    if (action === 'avatar') setAvatarOpen(true)
    if (action === 'switch') pickProfile(null)
    if (action === 'logout') signOut()
  }

  const series = useMemo(() => (tree ? buildSeries(tree) : null), [tree])

  // Loaded at start (to spot requested books that arrived) and again each time the Demandes tab opens.
  const onRequestsTab = route.name === 'requests'
  useEffect(() => {
    if (ready) loadRequests().then(setRequests, onError)
  }, [ready, onRequestsTab, onError])

  // A requested book that shows up in the library becomes "available", with a link to read it.
  useEffect(() => {
    if (!requests || !series) return
    const matches = availableMatches(requests, series)
    if (!matches.length) return
    Promise.all(matches.map((m) => updateRequest(m.requestId, { status: 'available', libraryBookId: m.bookId })))
      .then(loadRequests)
      .then(setRequests, onError)
  }, [requests, series, onError])

  const withRequests = async (change: Promise<unknown>) => {
    try {
      await change
      setRequests(await loadRequests())
    } catch (e) {
      onError(e)
    }
  }
  const readingBook = route.name === 'read' && tree ? allBooks(tree).find((b) => b.id === route.bookId) : undefined
  const openSeries = route.name === 'series' && series ? findSeries(series, route.key) : undefined
  const profile = profiles.find((p) => p.id === profileId)

  return (
    <>
      {connecting ? (
        <FullLoader />
      ) : !loggedIn ? (
        <LoginScreen connected={connected} error={loginError} onDone={() => { setLoginError(null); setConnected(connectedApps()) }}
          onError={onError} />
      ) : picking ? (
        <FolderPicker initial={picking.cancellable ? libraryRoot ?? '' : ''} message={picking.message} onPick={pickFolder}
          onCancel={picking.cancellable ? () => setPicking(null) : undefined} onError={onError} />
      ) : libraryRoot === null && rootError ? (
        <RetryScreen message={rootError} onRetry={() => setRootAttempt((n) => n + 1)} />
      ) : libraryRoot === null ? (
        <FullLoader />
      ) : !profileId ? (
        <ProfilesScreen onPick={(p) => pickProfile(p.id)} onError={onError} />
      ) : readingBook ? (
        <ReaderScreen
          key={readingBook.id}
          book={readingBook}
          next={series ? nextInSeries(series, readingBook.id) : undefined}
          profileId={profileId}
          onBack={() => {
            const home = series && seriesOfBook(series, readingBook.id)
            goBack(home ? seriesHref(home) : '#/')
          }}
          onError={onError}
        />
      ) : (
        <>
          <TopBar active={base.name === 'kind' ? base.kind : base.name} profile={profile} query={query} onQuery={setQuery}
            onAction={onProfileAction} />
          {base.name === 'home' && <HomeScreen series={series} progress={progress} offline={offline} onReset={resetBook} onToggleOffline={toggleOffline}
            libraryName={folderName(libraryRoot)} onChangeFolder={changeFolder} />}
          {base.name === 'history' && <HistoryScreen series={series} progress={progress} offline={offline} onReset={resetBook} onToggleOffline={toggleOffline} />}
          {base.name === 'requests' && profile && (
            <RequestsScreen profile={profile} profiles={profiles} requests={requests} onError={onError}
              onRequest={(book, note) => withRequests(addRequest(profile.id, book, note).then(() => setNotice('Demande envoyée.')))}
              onUpdate={(id, changes) => withRequests(updateRequest(id, changes))}
              onRemove={(id) => withRequests(removeRequest(id))}
              onBecomeAdmin={() => becomeAdmin(profile)} />
          )}
          {base.name === 'kind' && <KindScreen series={series} kind={base.kind} />}
          {base.name === 'search' && <SearchScreen series={series} query={query} />}
          {openSeries && (
            <SeriesModal series={openSeries} progress={progress} offline={offline} downloads={downloads} onToggleOffline={toggleOffline}
              onReset={resetBook} onClose={() => goBack(baseHash(base))} />
          )}
          {avatarOpen && profile && (
            <AvatarDialog profile={profile} onClose={() => setAvatarOpen(false)} onError={onError}
              onDone={() => { setAvatarOpen(false); loadProfiles().then(setProfiles, onError) }} />
          )}
          {pinOpen && profile && (
            <PinSettings profile={profile} onClose={() => setPinOpen(false)} onError={onError}
              onDone={() => { setPinOpen(false); loadProfiles().then(setProfiles, onError); setNotice('Code enregistré.') }} />
          )}
        </>
      )}
      {confirming && <ConfirmDialog {...confirming} onClose={() => setConfirming(null)} />}
      {adminOnly && (
        <Shell title="Dossier des livres" onClose={() => setAdminOnly(false)}>
          <Text color="muted">Seul l'admin peut changer le dossier des livres.</Text>
          <Button mt="6" w="full" onClick={() => setAdminOnly(false)}>OK</Button>
        </Shell>
      )}
      {notice && !error && (
        <Stack position="fixed" bottom="4" insetX="4" mx="auto" maxW="sm" p="3" rounded="md" bg="panel" direction="row" align="center" zIndex="20">
          <Text flex="1" fontSize="sm">{notice}</Text>
          <Button size="xs" variant="ghost" onClick={() => setNotice(null)}>OK</Button>
        </Stack>
      )}
      {error && (
        <Stack position="fixed" bottom="4" insetX="4" mx="auto" maxW="md" p="4" rounded="lg" bg="red.subtle" direction="row" align="center">
          <Text flex="1">{error}</Text>
          <Button size="sm" variant="ghost" onClick={() => setError(null)}>OK</Button>
        </Stack>
      )}
    </>
  )
}
