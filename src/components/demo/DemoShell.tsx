'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  ReactNode,
  ViewTransition,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
} from 'react'
import type { Container } from '@tsparticles/engine'
import Particles, { ParticlesProvider } from '@tsparticles/react'
import { loadSlim } from '@tsparticles/slim'
import RubiLoader from '@/app/components/Loaders/RubiLoader'
import { threshold } from '@/lib/constellation'
import { DemoEntry, demoByRoute, demos, markLeavingDemo, neighbour, titleTransitionName } from '@/lib/demos'

export interface Shortcut {
  key: string
  label: string
  run: () => void
}

interface DemoShellValue {
  demo: DemoEntry
  // Space toggles this. Starts true under reduced motion.
  paused: boolean
  setPaused: (paused: boolean) => void
  // True once the demo has put its first real frame on screen
  isReady: boolean
  setReady: () => void
  // One line naming the real work being waited on, or null
  setBoot: (message: string | null) => void
  // The demo cannot run here: keep the backdrop, drop the loader
  setUnavailable: (unavailable: boolean) => void
  chromeHidden: boolean
  reducedMotion: boolean
  registerShortcut: (shortcut: Shortcut) => () => void
  setPausable: (pausable: boolean) => void
}

const DemoShellContext = createContext<DemoShellValue | null>(null)

export function useDemoShell(): DemoShellValue {
  const value = useContext(DemoShellContext)
  if (!value) throw new Error('useDemoShell must be used inside the demos layout')
  return value
}

// Registers a demo-specific key. It is listed under "?" and never fires while
// focus is in an input, textarea or select.
export function useShortcut(key: string, label: string, run: () => void) {
  const { registerShortcut } = useDemoShell()
  const runRef = useRef(run)
  useEffect(() => {
    runRef.current = run
  })
  useEffect(
    () => registerShortcut({ key, label, run: () => runRef.current() }),
    [key, label, registerShortcut]
  )
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

const subscribeReducedMotion = (onChange: () => void) => {
  const query = window.matchMedia(REDUCED_MOTION)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

const useReducedMotion = () =>
  useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false
  )

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) &&
  // Range and checkbox inputs take no text, so shortcuts stay live on them
  !(target instanceof HTMLInputElement && ['range', 'checkbox', 'radio'].includes(target.type))

const BOOT_DELAY_MS = 300

export function DemoShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const demo = demoByRoute(pathname) ?? demos[0]

  const reducedMotion = useReducedMotion()
  // null until the visitor chooses: a stage starts paused under reduced motion
  const [userPaused, setUserPaused] = useState<boolean | null>(null)
  const [pausable, setPausable] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [boot, setBoot] = useState<string | null>(null)
  // The boot message whose 300 ms have elapsed
  const [slowBoot, setSlowBoot] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [chromeHidden, setChromeHidden] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([])
  const backdrop = useRef<Container | undefined>(undefined)

  const paused = userPaused ?? reducedMotion
  const setPaused = useCallback((value: boolean) => setUserPaused(value), [])

  // A new demo starts from the threshold again
  const [slug, setSlug] = useState(demo.slug)
  if (slug !== demo.slug) {
    setSlug(demo.slug)
    setUserPaused(null)
    setIsReady(false)
    setBoot(null)
    setUnavailable(false)
    setHelpOpen(false)
  }

  // The constellation means nothing is running here yet. Once the demo draws,
  // it stops: two animations competing for one GPU is how demos stutter.
  const readyRef = useRef(false)
  useEffect(() => {
    readyRef.current = isReady
    if (isReady) backdrop.current?.pause()
    else backdrop.current?.play()
  }, [isReady])

  // The loader appears only if boot takes longer than 300 ms
  useEffect(() => {
    if (!boot) return
    const timer = setTimeout(() => setSlowBoot(boot), BOOT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [boot])
  const bootVisible = boot !== null && slowBoot === boot && !isReady && !unavailable

  const registerShortcut = useCallback((shortcut: Shortcut) => {
    setShortcuts(current => [...current.filter(item => item.key !== shortcut.key), shortcut])
    return () => setShortcuts(current => current.filter(item => item !== shortcut))
  }, [])

  const setReady = useCallback(() => setIsReady(true), [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return
      const key = event.key
      if (key === 'Escape' && helpOpen) return setHelpOpen(false)
      if (key === '?') return setHelpOpen(open => !open)
      if (key === 'h' || key === 'H') return setChromeHidden(hidden => !hidden)
      if (key === '[') return router.push(neighbour(demo, -1).route)
      if (key === ']') return router.push(neighbour(demo, 1).route)
      if (key === ' ' && pausable) {
        // A focused button keeps its own Space
        if (event.target instanceof HTMLElement && ['BUTTON', 'A'].includes(event.target.tagName)) return
        event.preventDefault()
        return setPaused(!paused)
      }
      // A demo's own keys never take a key from a focused control (a slider's
      // arrows, a select's letters)
      if (event.target instanceof HTMLElement && ['INPUT', 'SELECT'].includes(event.target.tagName)) return
      const match = shortcuts.find(item => item.key.toLowerCase() === key.toLowerCase())
      if (match) {
        event.preventDefault()
        match.run()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [demo, helpOpen, pausable, paused, setPaused, router, shortcuts])

  const value = useMemo<DemoShellValue>(
    () => ({
      demo,
      paused,
      setPaused,
      isReady,
      setReady,
      setBoot,
      setUnavailable,
      chromeHidden,
      reducedMotion,
      registerShortcut,
      setPausable
    }),
    [demo, paused, setPaused, isReady, setReady, chromeHidden, reducedMotion, registerShortcut]
  )

  const index = demos.indexOf(demo)

  return (
    <DemoShellContext.Provider value={value}>
      <div
        className="demo-shell"
        data-variant={demo.variant}
        data-chrome={chromeHidden ? 'hidden' : 'shown'}
        data-ready={isReady ? 'true' : 'false'}
        data-reduced-motion={reducedMotion ? 'true' : 'false'}>
        <div className="demo-threshold" aria-hidden="true">
          <ParticlesProvider init={loadSlim}>
            <Particles
              id="demo-threshold"
              options={threshold}
              particlesLoaded={container => {
                backdrop.current = container
                // The demo can be ready before the constellation has loaded
                if (readyRef.current) container?.pause()
              }}
            />
          </ParticlesProvider>
        </div>

        <header className="demo-bar">
          <Link href="/" className="demo-back" onClick={() => markLeavingDemo(demo.slug)}>
            <span className="demo-diamond" aria-hidden="true" />
            <span className="demo-back-long">Back to portfolio</span>
            <span className="demo-back-short">Back</span>
          </Link>
          <ViewTransition name={titleTransitionName(demo.slug)} share="demo-title-travel">
            <h1 className="demo-title">{demo.title}</h1>
          </ViewTransition>
          <nav className="demo-pips" aria-label="Demos">
            {demos.map((entry, entryIndex) => (
              <Link
                key={entry.slug}
                href={entry.route}
                // Prefetching six other demos preloads stylesheets this page never uses
                prefetch={false}
                className="demo-pip"
                aria-label={entry.title}
                aria-current={entryIndex === index ? 'page' : undefined}
                title={entry.title}>
                <span className="demo-diamond" aria-hidden="true" />
              </Link>
            ))}
          </nav>
        </header>

        <main className="demo-main" key={demo.slug}>
          {children}
        </main>

        {bootVisible && (
          <div className="demo-boot" role="status">
            <RubiLoader type="white" height={32} width={32} />
            <p>{boot}</p>
          </div>
        )}

        {pausable && paused && !unavailable && (
          <button type="button" className="demo-play" onClick={() => setPaused(false)}>
            Paused. Play
          </button>
        )}

        {helpOpen && (
          <div className="demo-help" role="dialog" aria-label="Keyboard shortcuts">
            <dl>
              <ShortcutRow keys="H" label="Hide or show the controls" />
              {pausable && <ShortcutRow keys="Space" label="Pause or play" />}
              <ShortcutRow keys="[ ]" label="Previous or next demo" />
              {shortcuts.map(shortcut => (
                <ShortcutRow key={shortcut.key} keys={shortcut.key} label={shortcut.label} />
              ))}
              <ShortcutRow keys="?" label="This list" />
            </dl>
            <button type="button" className="demo-text-button" onClick={() => setHelpOpen(false)}>
              Close
            </button>
          </div>
        )}
      </div>
    </DemoShellContext.Provider>
  )
}

function ShortcutRow({ keys, label }: { keys: string; label: string }) {
  return (
    <div>
      <dt>
        <kbd>{keys}</kbd>
      </dt>
      <dd>{label}</dd>
    </div>
  )
}

/**
 * Stage variant: the demo fills the viewport and the chrome floats over it.
 * Put the canvas, the <Rail> and the <Ledger> inside; put <Notes> after it.
 */
export function Stage({
  children,
  pausable = true,
  className
}: {
  children: ReactNode
  // False for a stage with nothing to pause
  pausable?: boolean
  className?: string
}) {
  const { setPausable } = useDemoShell()
  useEffect(() => {
    setPausable(pausable)
    return () => setPausable(false)
  }, [pausable, setPausable])

  return (
    <section className={`demo-stage${className ? ` ${className}` : ''}`}>
      {children}
      <a className="demo-notes-link demo-chrome" href="#notes">
        Notes
      </a>
    </section>
  )
}

/**
 * Scroll variant: a visual stays pinned while a column of text and controls
 * scrolls past it. On phones the visual pins to the top 40% of the viewport.
 */
export function ScrollLayout({
  visual,
  children,
  pausable = false,
  className
}: {
  visual: ReactNode
  children: ReactNode
  pausable?: boolean
  className?: string
}) {
  const { setPausable } = useDemoShell()
  useEffect(() => {
    setPausable(pausable)
    return () => setPausable(false)
  }, [pausable, setPausable])

  return (
    <section className={`demo-scroll${className ? ` ${className}` : ''}`}>
      <div className="demo-scroll-visual">{visual}</div>
      <div className="demo-scroll-column">{children}</div>
    </section>
  )
}

/**
 * The last resort, where nothing can run: one sentence saying what is missing,
 * over the constellation. Also used for errors that stop the stage.
 */
export function Poster({
  children,
  image,
  action
}: {
  children: ReactNode
  // A still of the demo, shown dimmed behind the sentence
  image?: string
  action?: ReactNode
}) {
  const { setUnavailable } = useDemoShell()
  useEffect(() => {
    setUnavailable(true)
    return () => setUnavailable(false)
  }, [setUnavailable])

  return (
    <div className="demo-poster" role="status">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {image && <img src={image} alt="" />}
      <p>{children}</p>
      {action}
    </div>
  )
}
