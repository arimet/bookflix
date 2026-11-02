import { useEffect, useState, type RefObject } from 'react'
import { getCoverUrl } from '../covers/covers'
import type { Book } from '../library/library'

// Only covers scrolled into view are fetched.
export function useCoverUrl(book: Book | undefined, ref: RefObject<HTMLElement | null>) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!book || !ref.current) return
    let alive = true
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      getCoverUrl(book).then((u) => alive && setUrl(u))
    }, { rootMargin: '300px' })
    observer.observe(ref.current)
    return () => {
      alive = false
      observer.disconnect()
    }
  }, [book, ref])
  return url
}
