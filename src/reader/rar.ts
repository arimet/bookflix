import { createArchiveFromLibArchive } from '@prose-reader/archive-reader/archives/createArchiveFromLibArchive'
import { Archive } from 'libarchive.js'

// worker-bundle.js and libarchive.wasm are copied to public/libarchive by `npm run copy:libarchive`.
Archive.init({ workerUrl: `${import.meta.env.BASE_URL}libarchive/worker-bundle.js` })

export async function createArchiveFromRar(blob: Blob, name: string) {
  const reader = await Archive.open(new File([blob], name))
  return createArchiveFromLibArchive(reader, { name, encodingFormat: 'application/vnd.comicbook-rar' })
}
