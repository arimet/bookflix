type Position = { cfi: string; percentageEstimateOfBook: number; status: string }

// Opening a book is not reading it: the restored position is skipped, so a device holding a stale
// copy cannot stamp an old position with a fresh updatedAt and overwrite newer progress elsewhere.
export function positionRecorder() {
  let restored = false
  let last: string | undefined
  return ({ cfi, percentageEstimateOfBook, status }: Position): { cfi: string; percent: number } | null => {
    if (!restored) {
      if (status === 'success') {
        restored = true
        last = cfi
      }
      return null
    }
    if (!cfi || cfi === last) return null
    last = cfi
    return { cfi, percent: percentageEstimateOfBook }
  }
}
