'use client'

import {
  MutableRefObject,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { formatPrice } from '../utils'
import { Region } from '../types'
import styles from '../takumi-market.module.css'

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mediaQuery.matches)
    update()
    mediaQuery.addEventListener('change', update)
    return () => mediaQuery.removeEventListener('change', update)
  }, [])

  return reduced
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia(query)
    const update = () => setMatches(mediaQuery.matches)
    update()
    mediaQuery.addEventListener('change', update)
    return () => mediaQuery.removeEventListener('change', update)
  }, [query])

  return matches
}

export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [locked])
}

export function useFocusTrap<T extends HTMLElement>(ref: MutableRefObject<T | null>, active: boolean) {
  useEffect(() => {
    if (!active || !ref.current) {
      return
    }

    const element = ref.current
    const selectors = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ]

    const getFocusable = () =>
      Array.from(element.querySelectorAll<HTMLElement>(selectors.join(','))).filter(
        (node) => !node.hasAttribute('disabled') && !node.getAttribute('aria-hidden')
      )

    const focusable = getFocusable()
    focusable[0]?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') {
        return
      }

      const items = getFocusable()
      if (items.length === 0) {
        return
      }

      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [active, ref])
}

export function useEscape(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [active, onClose])
}

export function Reveal({
  children,
  delay = 0,
  className
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const reducedMotion = usePrefersReducedMotion()
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(reducedMotion)

  useEffect(() => {
    if (reducedMotion || !ref.current) {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [reducedMotion])

  return (
    <div
      ref={ref}
      className={`${styles.reveal} ${visible ? styles.revealVisible : ''} ${className ?? ''}`}
      style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

export function AnimatedPrice({
  value,
  region,
  className
}: {
  value: number
  region: Region
  className?: string
}) {
  const reducedMotion = usePrefersReducedMotion()
  const previous = useRef(value)
  const [displayValue, setDisplayValue] = useState(value)

  useEffect(() => {
    if (reducedMotion) {
      previous.current = value
      setDisplayValue(value)
      return
    }

    const start = previous.current
    const target = value
    if (start === target) {
      setDisplayValue(target)
      return
    }

    const duration = 200
    const startAt = performance.now()
    let frame = 0

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startAt) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      const next = Math.round(start + (target - start) * eased)
      setDisplayValue(next)
      if (progress < 1) {
        frame = window.requestAnimationFrame(tick)
      } else {
        previous.current = target
      }
    }

    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [reducedMotion, value])

  return <span className={className}>{formatPrice(displayValue, region)}</span>
}

export function DemoImage({
  src,
  alt,
  className,
  loading = 'lazy'
}: {
  src: string
  alt: string
  className?: string
  loading?: 'eager' | 'lazy'
}) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div className={`${styles.imageShell} ${className ?? ''}`}>
      <div className={`${styles.imagePlaceholder} ${loaded ? styles.imagePlaceholderHidden : ''}`} />
      <img
        src={src}
        alt={alt}
        className={`${styles.image} ${loaded ? styles.imageLoaded : ''}`}
        loading={loading}
        onLoad={() => setLoaded(true)}
      />
    </div>
  )
}

export function useDebouncedValue<T>(value: T, delay = 150) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timeout)
  }, [delay, value])

  return debounced
}

export function useNow(interval = 1000) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), interval)
    return () => window.clearInterval(timer)
  }, [interval])

  return now
}

export function useAnnouncementClock(interval = 30000) {
  const now = useNow(interval)
  return useMemo(() => now, [now])
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className={styles.visuallyHidden}>{children}</span>
}

