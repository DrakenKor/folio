import type { Metadata } from 'next'

export type DemoVariant = 'stage' | 'scroll'

export interface DemoEntry {
  slug: string
  route: string
  title: string
  line: string
  variant: DemoVariant
  // Names published blog posts use in <Demo name="..." />.
  aliases?: string[]
}

// The seven reworked demos, in home-page order. No other route belongs here.
export const demos: DemoEntry[] = [
  {
    slug: 'particles',
    route: '/gpu-particles-demo',
    title: 'Particles',
    line: 'A quarter of a million points, simulated on your GPU.',
    variant: 'stage'
  },
  {
    slug: 'shader',
    route: '/shader-demo',
    title: 'Shader playground',
    line: 'Edit the GLSL and the canvas recompiles as you type.',
    variant: 'stage',
    aliases: ['shader-playground']
  },
  {
    slug: 'math',
    route: '/math-gallery-demo',
    title: 'Math gallery',
    line: 'Four exhibits: fractals, Fourier, sorting, a small neural net.',
    variant: 'stage'
  },
  {
    slug: 'timeline',
    route: '/timeline-demo',
    title: 'Career timeline',
    line: 'Nine years of work wound around a helix.',
    variant: 'scroll'
  },
  {
    slug: 'image',
    route: '/image-processing-demo',
    title: 'Image filters',
    line: 'The same filter in Rust and JavaScript, on your own photo.',
    variant: 'stage',
    aliases: ['wasm-image-processing']
  },
  {
    slug: 'crypto',
    route: '/crypto-demo',
    title: 'Cryptography',
    line: 'How the locked posts on this blog are sealed.',
    variant: 'scroll'
  },
  {
    slug: 'wasm',
    route: '/wasm-demo',
    title: 'WASM benchmark',
    line: 'Rust and JavaScript on the same stopwatch.',
    variant: 'scroll',
    aliases: ['wasm-core']
  }
]

const trimSlash = (pathname: string) =>
  pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname

export function demoByRoute(pathname: string | null): DemoEntry | undefined {
  if (!pathname) return undefined
  const route = trimSlash(pathname)
  return demos.find(demo => demo.route === route)
}

export function demoByName(name: string): DemoEntry | undefined {
  return demos.find(
    demo => demo.slug === name || demo.aliases?.includes(name)
  )
}

export function isDemoRoute(pathname: string | null): boolean {
  return demoByRoute(pathname) !== undefined
}

export function neighbour(demo: DemoEntry, step: 1 | -1): DemoEntry {
  const index = demos.indexOf(demo)
  return demos[(index + step + demos.length) % demos.length]
}

export function demoMetadata(slug: string): Metadata {
  const demo = demos.find(entry => entry.slug === slug)
  if (!demo) throw new Error(`Unknown demo "${slug}"`)
  return {
    title: `${demo.title} - Manav Dhindsa`,
    description: demo.line,
    openGraph: {
      title: demo.title,
      description: demo.line,
      url: demo.route,
      type: 'website'
    }
  }
}

// Name shared by a home-page link label and the bar title so the label can
// travel between them in a view transition.
export const titleTransitionName = (slug: string) => `demo-title-${slug}`

// The demo a visitor is leaving, so the home page can receive its title back
// in the list instead of waiting behind its loader.
let leaving: string | null = null

export const markLeavingDemo = (slug: string | null) => {
  leaving = slug
}

export const leavingDemo = () => leaving

export const sourceUrl = (path: string) =>
  `https://github.com/DrakenKor/folio/blob/main/${path}`
