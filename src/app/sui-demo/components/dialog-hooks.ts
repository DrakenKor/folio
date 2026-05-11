'use client'

import { RefObject, useEffect, useRef } from 'react'

const focusableSelector =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [active])
}

export function useEscape(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onEscape()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [active, onEscape])
}

export function useFocusTrap<T extends HTMLElement>(ref: RefObject<T | null>, active: boolean) {
  const restoreTargetRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!active) {
      return
    }

    restoreTargetRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const panel = ref.current
    const focusable = () => Array.from(panel?.querySelectorAll<HTMLElement>(focusableSelector) ?? []).filter((node) => node.offsetParent !== null)

    window.setTimeout(() => {
      const [first] = focusable()
      first?.focus()
    }, 0)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') {
        return
      }

      const nodes = focusable()
      if (nodes.length === 0) {
        event.preventDefault()
        return
      }

      const first = nodes[0]
      const last = nodes[nodes.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    panel?.addEventListener('keydown', handleKeyDown)

    return () => {
      panel?.removeEventListener('keydown', handleKeyDown)
      restoreTargetRef.current?.focus()
    }
  }, [active, ref])
}
