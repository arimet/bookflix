// Profile avatars: smiling faces drawn in SVG, and one emoji per reading genre. Each comes with its colour.
export type AvatarDef = { id: string; label: string; color: string } & ({ svg: string } | { emoji: string })

const INK = '#141414'
const eyes = {
  round: `<circle cx="36" cy="44" r="5" fill="${INK}"/><circle cx="64" cy="44" r="5" fill="${INK}"/>`,
  wink: `<circle cx="36" cy="44" r="5" fill="${INK}"/><path d="M56 45 Q64 39 72 45" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  sleepy: `<path d="M29 46 Q36 51 43 46 M57 46 Q64 51 71 46" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  stars: `<path d="M36 37 l2 5 5 0 -4 3 2 5 -5 -3 -5 3 2 -5 -4 -3 5 0z M64 37 l2 5 5 0 -4 3 2 5 -5 -3 -5 3 2 -5 -4 -3 5 0z" fill="${INK}"/>`,
}
const smile = `<path d="M32 66 Q50 82 68 66" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>`
const face = (eye: keyof typeof eyes, extra = '', mouth = smile) => `${eyes[eye]}${extra}${mouth}`

export const AVATARS: AvatarDef[] = [
  { id: 'face:glasses', label: 'Lunettes', color: '#e50914', svg: face('round', `<circle cx="36" cy="44" r="11" fill="none" stroke="${INK}" stroke-width="4"/><circle cx="64" cy="44" r="11" fill="none" stroke="${INK}" stroke-width="4"/><line x1="47" y1="44" x2="53" y2="44" stroke="${INK}" stroke-width="4"/>`) },
  { id: 'face:wink', label: "Clin d'œil", color: '#f5b301', svg: face('wink') },
  { id: 'face:beanie', label: 'Bonnet', color: '#1f9bde', svg: face('round', `<path d="M14 26 Q50 -6 86 26 L86 32 L14 32 Z" fill="${INK}" opacity=".85"/><circle cx="50" cy="6" r="6" fill="${INK}" opacity=".85"/>`) },
  { id: 'face:blush', label: 'Timide', color: '#2fbf71', svg: face('round', '<circle cx="26" cy="60" r="6" fill="#fff" opacity=".35"/><circle cx="74" cy="60" r="6" fill="#fff" opacity=".35"/>') },
  { id: 'face:sleepy', label: 'Endormi', color: '#9b51e0', svg: face('sleepy') },
  { id: 'face:bow', label: 'Nœud', color: '#ff7a45', svg: face('round', `<path d="M60 18 L74 10 L74 26 Z M88 18 L74 10 L74 26 Z" fill="${INK}" opacity=".85"/><circle cx="74" cy="18" r="4" fill="${INK}"/>`) },
  { id: 'face:stars', label: 'Étoiles', color: '#14b8a6', svg: face('stars') },
  { id: 'face:mustache', label: 'Moustache', color: '#e4407b', svg: face('round', `<path d="M34 66 Q42 58 50 64 Q58 58 66 66 Q58 68 50 66 Q42 68 34 66Z" fill="${INK}"/>`, `<path d="M38 74 Q50 80 62 74" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>`) },
  { id: 'genre:dragon', label: 'Fantasy', color: '#ff7a45', emoji: '🐉' },
  { id: 'genre:rocket', label: 'SF', color: '#14b8a6', emoji: '🚀' },
  { id: 'genre:dagger', label: 'Polar', color: '#e4407b', emoji: '🗡️' },
  { id: 'genre:heart', label: 'Romance', color: '#e50914', emoji: '💘' },
  { id: 'genre:ninja', label: 'Manga', color: '#f5b301', emoji: '🥷' },
  { id: 'genre:ghost', label: 'Frisson', color: '#1f9bde', emoji: '👻' },
  { id: 'genre:compass', label: 'Aventure', color: '#2fbf71', emoji: '🧭' },
  { id: 'genre:tophat', label: 'Classique', color: '#9b51e0', emoji: '🎩' },
]

export const findAvatar = (id: string | undefined) => AVATARS.find((a) => a.id === id)
