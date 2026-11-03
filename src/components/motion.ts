import type { MotionProps } from 'motion/react'

const spring = { type: 'spring', bounce: 0.15, duration: 0.4 } as const

// A card grows in when it arrives and shrinks away when it leaves; its neighbours slide into the gap.
// Used inside <AnimatePresence mode="popLayout" initial={false}>: nothing moves on the first render.
export const popInOut: MotionProps = {
  layout: true,
  initial: { opacity: 0, scale: 0.85 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.85 },
  transition: spring,
}

// A whole block (a row of books, a group of requests) folds away when its last item leaves.
// Clipped only while it moves: a card scaled up on hover must not be cut once it is open.
export const foldInOut: MotionProps = {
  initial: { height: 0, opacity: 0, overflow: 'hidden' },
  animate: { height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } },
  exit: { height: 0, opacity: 0, overflow: 'hidden' },
  transition: spring,
}
