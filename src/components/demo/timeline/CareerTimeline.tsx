'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { ScrollLayout, useDemoShell } from '@/components/demo/DemoShell'
import { Ledger } from '@/components/demo/Ledger'
import { Notes, NotesSection, NotesSource } from '@/components/demo/Notes'
import { Rail } from '@/components/demo/Rail'
import { Select, Toggle } from '@/components/demo/controls'
import { ResumeDataLoader } from '@/lib/resume-data-loader'
import { TimelinePositionCalculator, roleEnd, timelineStats } from '@/lib/timeline-position-calculator'
import { RoleArticle, TimelineRole, capSentences } from './RoleArticle'
import { YearRail } from './YearRail'
import './timeline.css'

// The scene's JavaScript (three.js and friends) loads after the list is on screen
const Scene = dynamic(() => import('./Scene'), { ssr: false })

const EXPERIENCES = ResumeDataLoader.getInstance().getExperiencesOldestFirst()
const TECHNOLOGIES = [...new Set(EXPERIENCES.flatMap(role => role.technologies))].sort((a, b) => a.localeCompare(b))
const DAY_MS = 86_400_000
// Until the browser knows today's date, the last role is drawn a year long
const FALLBACK_END = new Date(EXPERIENCES[EXPERIENCES.length - 1].startDate.getTime() + 365 * DAY_MS)

const noSubscribe = () => () => {}

let webgl: boolean | undefined
const hasWebGL = () => {
  if (webgl === undefined) {
    webgl = false
    // Development only: ?nogl shows the page as it is without WebGL
    if (process.env.NODE_ENV !== 'production' && window.location.search.includes('nogl')) return webgl
    try {
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
      webgl = context !== null
      context?.getExtension('WEBGL_lose_context')?.loseContext()
    } catch {
      webgl = false
    }
  }
  return webgl
}

// Today as a whole day, or 0 on the server: the page never prints a date it cannot know when it is built
const today = () => Math.floor(Date.now() / DAY_MS) * DAY_MS

export function CareerTimeline() {
  const { setReady, reducedMotion, paused } = useDemoShell()
  const gl = useSyncExternalStore(noSubscribe, hasWebGL, () => null)
  const todayMs = useSyncExternalStore(noSubscribe, today, () => 0)

  const [active, setActive] = useState(0)
  const [tech, setTech] = useState<string | null>(null)
  const [lookAround, setLookAround] = useState(false)
  const listRef = useRef<HTMLOListElement | null>(null)
  const railRef = useRef<HTMLDivElement | null>(null)
  const dateRef = useRef(EXPERIENCES[0].startDate.getTime())

  const end = useMemo(() => (todayMs ? new Date(todayMs) : FALLBACK_END), [todayMs])
  const roles = useMemo<TimelineRole[]>(
    () =>
      EXPERIENCES.map(role => ({
        id: role.id,
        company: role.company,
        position: role.position,
        location: role.location,
        place: role.location.split(',')[0],
        start: role.startDate,
        end: roleEnd(role, end),
        current: role.endDate === null,
        description: capSentences(role.description),
        achievements: role.achievements,
        technologies: role.technologies
      })),
    [end]
  )
  const calc = useMemo(() => new TimelinePositionCalculator(roles[0].start, end), [roles, end])
  const stats = useMemo(() => timelineStats(EXPERIENCES, end), [end])
  const matches = useMemo(() => roles.map(role => !tech || role.technologies.includes(tech)), [roles, tech])

  // Ready once the list is up and, with WebGL, the scene has been created: until then the shell
  // keeps its constellation up instead of showing an empty pane while three.js loads.
  useEffect(() => {
    if (gl === false) setReady()
  }, [gl, setReady])

  // Scroll to date: the reference line is where the first role's top sits at the top of the page,
  // so the camera starts at the first station. A role is at its start date when its top reaches
  // the line and at its end date when its bottom does.
  const items = useCallback(() => Array.from(listRef.current?.children ?? []) as HTMLElement[], [])
  const referenceLine = useCallback(() => (items()[0]?.getBoundingClientRect().top ?? 0) + window.scrollY, [items])

  useEffect(() => {
    const onScroll = () => {
      const line = referenceLine()
      const boxes = items().map(item => item.getBoundingClientRect())
      const found = boxes.findIndex(item => line < item.bottom)
      const index = found === -1 ? boxes.length - 1 : found
      const box = boxes[index]
      const role = roles[index]
      const progress = Math.max(0, Math.min(1, (line - box.top) / box.height))
      dateRef.current = role.start.getTime() + progress * (role.end.getTime() - role.start.getTime())
      setActive(index)
      setLookAround(false)
      const rail = railRef.current
      rail?.style.setProperty('--timeline-p', String(calc.paramAtDate(dateRef.current)))
      rail?.setAttribute('data-over', String(boxes[boxes.length - 1].bottom < window.innerHeight / 2))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [roles, calc, items, referenceLine])

  const seek = useCallback(
    (ms: number, smooth: boolean) => {
      const index = Math.max(0, roles.findLastIndex(role => role.start.getTime() <= ms))
      const role = roles[index]
      const box = items()[index].getBoundingClientRect()
      const progress = Math.max(0, Math.min(1, (ms - role.start.getTime()) / (role.end.getTime() - role.start.getTime())))
      window.scrollTo({
        top: window.scrollY + box.top - referenceLine() + progress * box.height,
        behavior: smooth && !reducedMotion ? 'smooth' : 'auto'
      })
    },
    [roles, items, referenceLine, reducedMotion]
  )

  const ledger = (
    <Ledger
      placement={gl === false ? 'inline' : 'stage'}
      label="Career in numbers"
      rows={[
        { key: 'Roles', value: stats.roles },
        { key: 'Years', value: todayMs ? stats.years.toFixed(1) : '-' },
        { key: 'Companies', value: stats.companies },
        { key: 'Technologies', value: stats.technologies }
      ]}
    />
  )

  return (
    <>
      <ScrollLayout
        className={gl === false ? 'timeline timeline-nogl' : 'timeline'}
        visual={
          <div className="timeline-stage">
            {gl && (
              <div className="timeline-canvas" aria-hidden="true" data-look={lookAround ? 'true' : 'false'}>
                <Scene
                  roles={roles}
                  calc={calc}
                  dateRef={dateRef}
                  active={active}
                  matches={matches}
                  lookAround={lookAround}
                  reduced={reducedMotion}
                  paused={paused}
                  onReady={setReady}
                />
              </div>
            )}
            {gl && (
              <Rail label="Timeline">
                <Toggle label="Look around" checked={lookAround} onChange={setLookAround} />
                <Select
                  label="Technologies"
                  value={tech ?? ''}
                  options={[{ value: '', label: 'All roles' }, ...TECHNOLOGIES.map(name => ({ value: name, label: name }))]}
                  onChange={value => setTech(value || null)}
                />
              </Rail>
            )}
            {gl !== false && ledger}
          </div>
        }>
        <div className="timeline-lede">
          {gl === false && ledger}
          {tech ? (
            <p role="status">
              Showing the roles that used {tech}.{' '}
              <button type="button" className="demo-text-button" onClick={() => setTech(null)}>
                Show all
              </button>
            </p>
          ) : (
            <p>{roles.length} roles, oldest first.</p>
          )}
        </div>
        <ol ref={listRef} className="timeline-roles">
          {roles.map((role, index) => (
            <li key={role.id}>
              <RoleArticle
                role={role}
                active={index === active}
                match={tech ? matches[index] : null}
                tech={tech}
                onTech={setTech}
              />
            </li>
          ))}
        </ol>
      </ScrollLayout>
      <YearRail roles={roles} calc={calc} active={active} matches={tech ? matches : null} onSeek={seek} railRef={railRef} />
      <Notes slug="timeline">
        <NotesSection title="What you are looking at">
          <p>
            Nine years of work, drawn as a helix. Height is time: one turn is three years. Scroll and the camera climbs.
          </p>
          <p>
            The helix illustrates the list. Each station is the start of a role, the brighter stretch is how long it
            lasted, and a ring marks a move to a new city.
          </p>
        </NotesSection>
        <NotesSection title="How it works">
          <p>
            The list on the right is the real content. The scene reads the scroll position and places the camera at the
            matching date.
          </p>
        </NotesSection>
        <NotesSource
          files={[
            'src/components/demo/timeline/CareerTimeline.tsx',
            'src/components/demo/timeline/Scene.tsx',
            'src/lib/resume-data-loader.ts'
          ]}
        />
      </Notes>
    </>
  )
}
