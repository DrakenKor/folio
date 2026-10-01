import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { RefObject, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { CatmullRomCurve3, Color, InstancedMesh, Matrix4, PerspectiveCamera, Quaternion, SRGBColorSpace, Vector3 } from 'three'
import { TimelinePositionCalculator, januaries } from '@/lib/timeline-position-calculator'
import type { TimelineRole } from './RoleArticle'

interface SceneProps {
  roles: TimelineRole[]
  calc: TimelinePositionCalculator
  // The date the camera should be looking at, in ms. Written by the page as it scrolls.
  dateRef: RefObject<number>
  active: number
  // One entry per role: false dims it while a technology is chosen
  matches: boolean[]
  lookAround: boolean
  reduced: boolean
  paused: boolean
  // The first frame is about to render
  onReady: () => void
}

type Tone = 'active' | 'lit' | 'dim'

// Bone at a fraction of its brightness. The active arc is brighter than white
// so bloom, which only keeps values above 1, catches it and nothing else.
const bone = (level: number) => new Color().setRGB(0.82 * level, 0.82 * level, 0.82 * level, SRGBColorSpace)
const TONES: Record<Tone, Color> = { active: new Color().setRGB(1.8, 1.8, 1.8), lit: bone(0.8), dim: bone(0.14) }
const BASE = bone(0.3)

// R3F 9.7 still builds a THREE.Clock, which three 0.186 warns about once, even in production.
// Hide that one line until the canvas exists, then put console.warn back.
const warn = console.warn
console.warn = (...args: unknown[]) => {
  if (!String(args[0]).includes('THREE.Clock')) warn(...args)
}
const restoreWarn = () => {
  console.warn = warn
}
const TICK = bone(0.5)

const CAMERA_DISTANCE = 24
const CAMERA_RISE = 6
const INTRO_SECONDS = 1.2
const DAMPING = 4

const subscribeVisibility = (onChange: () => void) => {
  document.addEventListener('visibilitychange', onChange)
  return () => document.removeEventListener('visibilitychange', onChange)
}

const tube = (calc: TimelinePositionCalculator, from: number, to: number) => {
  const count = Math.max(8, Math.ceil((to - from) * 480))
  const points = Array.from({ length: count + 1 }, (_, index) => calc.pointAtParam(from + ((to - from) * index) / count))
  return { curve: new CatmullRomCurve3(points), segments: count }
}

function Arc({ calc, from, to, radius, color }: { calc: TimelinePositionCalculator; from: number; to: number; radius: number; color: Color }) {
  const { curve, segments } = useMemo(() => tube(calc, from, to), [calc, from, to])
  return (
    <mesh>
      <tubeGeometry args={[curve, segments, radius, 6, false]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  )
}

function Helix({ roles, calc, tones }: { roles: TimelineRole[]; calc: TimelinePositionCalculator; tones: Tone[] }) {
  return (
    <>
      <Arc calc={calc} from={0} to={1} radius={0.05} color={BASE} />
      {roles.map((role, index) => (
        <Arc
          key={role.id}
          calc={calc}
          from={calc.paramAtDate(role.start)}
          to={calc.paramAtDate(role.end)}
          radius={0.1}
          color={TONES[tones[index]]}
        />
      ))}
    </>
  )
}

function Station({ role, position, tone }: { role: TimelineRole; position: Vector3; tone: Tone }) {
  return (
    <group position={position}>
      <mesh scale={tone === 'active' ? 1.25 : 0.8}>
        <octahedronGeometry args={[0.6]} />
        <meshBasicMaterial color={TONES[tone]} toneMapped={false} />
      </mesh>
      <Html>
        <div className="timeline-label" data-tone={tone}>
          {role.company}
        </div>
      </Html>
    </group>
  )
}

// A ring around the helix where the city changes, with the place name
function PlaceRing({ place, calc, date }: { place: string; calc: TimelinePositionCalculator; date: Date }) {
  const t = calc.paramAtDate(date)
  const position = useMemo(() => calc.pointAtParam(t), [calc, t])
  const quaternion = useMemo(() => {
    const tangent = calc.pointAtParam(Math.min(1, t + 0.002)).sub(calc.pointAtParam(Math.max(0, t - 0.002))).normalize()
    return new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), tangent)
  }, [calc, t])
  return (
    <group position={position} quaternion={quaternion}>
      <mesh>
        <torusGeometry args={[1.1, 0.04, 6, 40]} />
        <meshBasicMaterial color={TICK} toneMapped={false} />
      </mesh>
      <Html>
        <div className="timeline-place">{place}</div>
      </Html>
    </group>
  )
}

// One tick and numeral at each January, pointing out from the helix
function YearTicks({ calc }: { calc: TimelinePositionCalculator }) {
  const ticks = useMemo(
    () =>
      januaries(calc.start, calc.end).map(date => {
        const from = calc.pointAtDate(date)
        const to = from.clone().add(new Vector3(from.x, 0, from.z).normalize().multiplyScalar(2.4))
        return { year: date.getUTCFullYear(), from, to }
      }),
    [calc]
  )
  const positions = useMemo(() => new Float32Array(ticks.flatMap(({ from, to }) => [...from.toArray(), ...to.toArray()])), [ticks])
  return (
    <>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={TICK} toneMapped={false} />
      </lineSegments>
      {ticks.map(tick => (
        <Html key={tick.year} position={tick.to}>
          <div className="timeline-year">{tick.year}</div>
        </Html>
      ))}
    </>
  )
}

// A seeded generator, so the stars are the same on every visit
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildStars(height: number) {
  const random = mulberry32(7)
  const points = Array.from({ length: 600 }, () => {
    const angle = random() * Math.PI * 2
    const radius = 22 + random() * 60
    return new Vector3(Math.cos(angle) * radius, -20 + random() * (height + 40), Math.sin(angle) * radius)
  })
  const segments: number[] = []
  points.forEach((a, i) => {
    points
      .slice(i + 1)
      .map(b => ({ b, d: a.distanceToSquared(b) }))
      .filter(({ d }) => d < 144)
      .sort((x, y) => x.d - y.d)
      .slice(0, 2)
      .forEach(({ b }) => segments.push(...a.toArray(), ...b.toArray()))
  })
  return { points, lines: new Float32Array(segments) }
}

// About 600 small octahedra with lines between near neighbours: the home page's constellation, given depth
function Stars({ height }: { height: number }) {
  const mesh = useRef<InstancedMesh>(null)
  const { points, lines } = useMemo(() => buildStars(height), [height])

  useEffect(() => {
    const matrix = new Matrix4()
    const rotation = new Quaternion()
    points.forEach((point, index) => {
      const size = 0.6 + (index % 7) / 7
      mesh.current?.setMatrixAt(index, matrix.compose(point, rotation, new Vector3(size, size, size)))
    })
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true
  }, [points])

  return (
    <>
      <instancedMesh ref={mesh} args={[undefined, undefined, points.length]} frustumCulled={false}>
        <octahedronGeometry args={[0.16]} />
        <meshBasicMaterial color={bone(0.5)} toneMapped={false} />
      </instancedMesh>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[lines, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={bone(0.14)} toneMapped={false} />
      </lineSegments>
    </>
  )
}

// A faint arc of points from an earlier role to the next one that shares a technology
function Trail({ from, to, lit }: { from: Vector3; to: Vector3; lit: boolean }) {
  const positions = useMemo(() => {
    const control = from.clone().add(to).multiplyScalar(0.5)
    control.x *= 0.45
    control.z *= 0.45
    control.y += 2
    const points = Array.from({ length: 40 }, (_, index) => {
      const t = index / 39
      return from.clone().multiplyScalar((1 - t) ** 2).addScaledVector(control, 2 * (1 - t) * t).addScaledVector(to, t * t)
    })
    return new Float32Array(points.flatMap(point => point.toArray()))
  }, [from, to])
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.16} sizeAttenuation color={lit ? TONES.lit : BASE} toneMapped={false} depthWrite={false} />
    </points>
  )
}

// Steps quality down when the median of 60 frames is over 22 ms, and never back up
function QualityMonitor({ onDecline }: { onDecline: () => void }) {
  const times = useRef<number[]>([])
  useFrame((_, delta) => {
    times.current.push(delta * 1000)
    if (times.current.length < 60) return
    const sorted = [...times.current].sort((a, b) => a - b)
    times.current = []
    if (sorted[30] > 22) onDecline()
  })
  return null
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

function CameraRig({
  calc,
  roles,
  dateRef,
  lookRef,
  reduced,
  lookAround
}: {
  calc: TimelinePositionCalculator
  roles: TimelineRole[]
  dateRef: RefObject<number>
  lookRef: RefObject<Vector3>
  reduced: boolean
  lookAround: boolean
}) {
  const invalidate = useThree(state => state.invalidate)
  const overview = useMemo(
    () => ({ position: new Vector3(0, calc.height + 30, 70), look: new Vector3(0, calc.height * 0.4, 0) }),
    [calc]
  )
  const position = useRef(new Vector3())
  const goalPosition = useRef(new Vector3())
  const goalLook = useRef(new Vector3())
  const intro = useRef(0)
  const started = useRef(false)

  useFrame(({ camera }, delta) => {
    const dt = Math.min(delta, 0.1)
    if (lookAround) {
      // OrbitControls owns the camera. Keep our state on it so locking again eases back.
      position.current.copy(camera.position)
      return
    }
    const focus = calc.pointAtDate(dateRef.current, goalLook.current)
    goalPosition.current
      .set(focus.x, 0, focus.z)
      .normalize()
      .multiplyScalar(CAMERA_DISTANCE)
      .add(focus)
      .setY(focus.y + CAMERA_RISE)

    if (!started.current) {
      started.current = true
      position.current.copy(reduced ? goalPosition.current : overview.position)
      lookRef.current.copy(reduced ? goalLook.current : overview.look)
    }
    if (reduced) {
      // A straight cut
      position.current.copy(goalPosition.current)
      lookRef.current.copy(goalLook.current)
    } else if (intro.current < 1) {
      intro.current = Math.min(1, intro.current + dt / INTRO_SECONDS)
      const k = easeInOut(intro.current)
      position.current.lerpVectors(overview.position, goalPosition.current, k)
      lookRef.current.lerpVectors(overview.look, goalLook.current, k)
    } else {
      const k = 1 - Math.exp(-dt * DAMPING)
      position.current.lerp(goalPosition.current, k)
      lookRef.current.lerp(goalLook.current, k)
    }
    camera.position.copy(position.current)
    camera.lookAt(lookRef.current)
  })

  // Hold the helix a little above centre, clear of the rail and ledger along the bottom
  const size = useThree(state => state.size)
  const camera = useThree(state => state.camera)
  useEffect(() => {
    const lift = size.width >= 768 ? 70 : 0
    if (camera.type === 'PerspectiveCamera') (camera as PerspectiveCamera).setViewOffset(size.width, size.height, 0, lift, size.width, size.height)
    invalidate()
  }, [size, camera, invalidate])

  // Under reduced motion the loop only runs on demand: render when the page scrolls
  useEffect(() => {
    if (!reduced) return
    const render = () => invalidate()
    window.addEventListener('scroll', render, { passive: true })
    return () => window.removeEventListener('scroll', render)
  }, [reduced, invalidate])

  // Read-only state on the wrapper, for tests: the role the camera is on, and how far
  // (in world units) the damped target trails the date's point on the helix
  const gl = useThree(state => state.gl)
  const wrapper = useRef<HTMLElement | null>(null)
  useEffect(() => {
    wrapper.current = gl.domElement.closest<HTMLElement>('.timeline-canvas')
  }, [gl])
  const shown = useRef({ role: '', lag: '' })
  useFrame(() => {
    const target = wrapper.current
    if (!target) return
    const role = String(roles.findLastIndex(item => item.start.getTime() <= dateRef.current))
    const lag = calc.pointAtDate(dateRef.current).distanceTo(lookRef.current).toFixed(1)
    if (role !== shown.current.role) target.dataset.role = shown.current.role = role
    if (lag !== shown.current.lag) target.dataset.lag = shown.current.lag = lag
  })

  return null
}

function Orbit({ lookRef }: { lookRef: RefObject<Vector3> }) {
  const controls = useThree(state => state.controls) as { target: Vector3; update: () => void } | null
  useEffect(() => {
    controls?.target.copy(lookRef.current)
    controls?.update()
  }, [controls, lookRef])
  return <OrbitControls makeDefault enablePan={false} enableZoom={false} />
}

export default function Scene({ roles, calc, dateRef, active, matches, lookAround, reduced, paused, onReady }: SceneProps) {
  // 2 is full resolution with bloom, 1 is three quarters, 0 is half with no bloom
  const [quality, setQuality] = useState(2)
  const hidden = useSyncExternalStore(
    subscribeVisibility,
    () => document.hidden,
    () => false
  )
  const lookRef = useRef(new Vector3())

  const phone = window.matchMedia('(max-width: 767px)').matches
  const dpr = Math.min(window.devicePixelRatio, phone ? 1.5 : 2) * [0.5, 0.75, 1][quality]
  const frameloop = hidden || (paused && !reduced) ? 'never' : reduced ? 'demand' : 'always'

  const tones = roles.map<Tone>((_, index) => (!matches[index] ? 'dim' : index === active ? 'active' : 'lit'))
  const stations = useMemo(() => roles.map(role => calc.pointAtDate(role.start)), [roles, calc])
  const trails = useMemo(
    () =>
      roles.flatMap((role, index) => {
        const earlier = roles.slice(0, index).findLastIndex(other => other.technologies.some(name => role.technologies.includes(name)))
        return earlier === -1 ? [] : [{ from: earlier, to: index }]
      }),
    [roles]
  )

  return (
    <Canvas
      aria-hidden="true"
      flat
      dpr={dpr}
      frameloop={frameloop}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      camera={{ fov: 40, near: 0.1, far: 400 }}
      onCreated={() => {
        restoreWarn()
        onReady()
      }}>
      <color attach="background" args={['#000000']} />
      {!reduced && <QualityMonitor onDecline={() => setQuality(level => Math.max(0, level - 1))} />}
      <CameraRig calc={calc} roles={roles} dateRef={dateRef} lookRef={lookRef} reduced={reduced} lookAround={lookAround} />
      {lookAround && <Orbit lookRef={lookRef} />}
      <Helix roles={roles} calc={calc} tones={tones} />
      <YearTicks calc={calc} />
      <Stars height={calc.height} />
      {roles.map((role, index) => (
        <Station key={role.id} role={role} position={stations[index]} tone={tones[index]} />
      ))}
      {roles.map((role, index) =>
        index === 0 || role.place !== roles[index - 1].place ? <PlaceRing key={role.id} place={role.place} calc={calc} date={role.start} /> : null
      )}
      {trails.map(({ from, to }) => (
        <Trail key={`${from}-${to}`} from={stations[from]} to={stations[to]} lit={active === from || active === to} />
      ))}
      {quality > 0 && (
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur intensity={0.45} luminanceThreshold={1} luminanceSmoothing={0.1} />
        </EffectComposer>
      )}
    </Canvas>
  )
}
