import { SectionType } from '@/types'

export interface NavigationRoute {
  section: SectionType
  path: string
  title: string
  description: string
  keywords: string[]
}

export const navigationRoutes: NavigationRoute[] = [
  {
    section: SectionType.HOME,
    path: '/',
    title: 'Manav Dhindsa - Software Engineer Portfolio',
    description: 'Interactive 3D portfolio showcasing 8+ years of software engineering experience',
    keywords: ['software engineer', 'portfolio', '3D', 'interactive', 'web development']
  },
  {
    section: SectionType.RESUME,
    path: '/resume',
    title: 'Interactive Resume Timeline - Manav Dhindsa',
    description: '3D timeline showcasing 8+ years of experience across PropTech, LegalTech, and test automation',
    keywords: ['resume', 'experience', 'timeline', '3D', 'career', 'software engineer']
  },
  {
    section: SectionType.MATH_GALLERY,
    path: '/math-gallery',
    title: 'Mathematical Art Gallery - Interactive Visualizations',
    description: 'Explore Fourier transforms, fractals, and algorithm visualizations in 3D',
    keywords: ['mathematics', 'visualization', 'fourier', 'fractals', 'algorithms', 'interactive']
  },
  {
    section: SectionType.CODE_VISUALIZER,
    path: '/code-visualizer',
    title: 'Code Architecture Visualizer - 3D Project Explorer',
    description: 'Interactive 3D visualization of code architecture and project dependencies',
    keywords: ['code', 'architecture', 'visualization', 'dependencies', '3D', 'projects']
  },
  {
    section: SectionType.WASM_DEMOS,
    path: '/wasm-demos',
    title: 'WebAssembly Performance Demos - High-Performance Web',
    description: 'Experience high-performance web applications powered by WebAssembly',
    keywords: ['webassembly', 'wasm', 'performance', 'rust', 'high-performance', 'demos']
  },
  {
    section: SectionType.SHADER_PLAYGROUND,
    path: '/shader-playground',
    title: 'Shader Art Playground - GPU-Accelerated Graphics',
    description: 'Interactive GPU-accelerated visual effects and shader programming',
    keywords: ['shaders', 'gpu', 'graphics', 'webgl', 'visual effects', 'interactive']
  }
]

export class NavigationController {
  private static instance: NavigationController
  private currentRoute: NavigationRoute
  private listeners: Set<(route: NavigationRoute) => void> = new Set()
  private keyboardListeners: Set<(event: KeyboardEvent) => void> = new Set()

  private constructor() {
    this.currentRoute = navigationRoutes[0]
    this.initializeRouting()
    this.initializeKeyboardNavigation()
  }

  static getInstance(): NavigationController {
    if (!NavigationController.instance) {
      NavigationController.instance = new NavigationController()
    }
    return NavigationController.instance
  }

  private initializeRouting() {
    // Only initialize routing on the client side
    if (typeof window === 'undefined') return

    // Handle browser back/forward buttons
    window.addEventListener('popstate', (event) => {
      const section = this.getSectionFromPath(window.location.pathname)
      if (section) {
        this.navigateToSection(section, false) // Don't push to history
      }
    })

    // Set initial route based on current URL
    const initialSection = this.getSectionFromPath(window.location.pathname)
    if (initialSection) {
      this.setCurrentSection(initialSection)
    }
  }

  private initializeKeyboardNavigation() {
    // Only initialize keyboard navigation on the client side
    if (typeof window === 'undefined') return

    const handleKeyDown = (event: KeyboardEvent) => {
      // Notify all keyboard listeners
      this.keyboardListeners.forEach(listener => listener(event))
    }

    document.addEventListener('keydown', handleKeyDown)
  }

  private getSectionFromPath(path: string): SectionType | null {
    const route = navigationRoutes.find(r => r.path === path)
    return route?.section || null
  }

  private getRouteFromSection(section: SectionType): NavigationRoute {
    return navigationRoutes.find(r => r.section === section) || navigationRoutes[0]
  }

  getCurrentRoute(): NavigationRoute {
    return this.currentRoute
  }

  getCurrentSection(): SectionType {
    return this.currentRoute.section
  }

  navigateToSection(section: SectionType, pushToHistory: boolean = true): void {
    const newRoute = this.getRouteFromSection(section)

    if (newRoute.section === this.currentRoute.section) {
      return // Already on this section
    }

    this.currentRoute = newRoute

    // Update browser URL and history (client-side only)
    if (typeof window !== 'undefined' && pushToHistory) {
      window.history.pushState(
        { section: section },
        newRoute.title,
        newRoute.path
      )
    }

    // Update document title and meta tags (client-side only)
    if (typeof window !== 'undefined') {
      this.updatePageMetadata(newRoute)
    }

    // Notify listeners
    this.listeners.forEach(listener => listener(newRoute))
  }

  private setCurrentSection(section: SectionType): void {
    const newRoute = this.getRouteFromSection(section)
    this.currentRoute = newRoute
    this.updatePageMetadata(newRoute)
  }

  private updatePageMetadata(route: NavigationRoute): void {
    // Update document title
    document.title = route.title

    // Update meta description
    let metaDescription = document.querySelector('meta[name="description"]')
    if (!metaDescription) {
      metaDescription = document.createElement('meta')
      metaDescription.setAttribute('name', 'description')
      document.head.appendChild(metaDescription)
    }
    metaDescription.setAttribute('content', route.description)

    // Update meta keywords
    let metaKeywords = document.querySelector('meta[name="keywords"]')
    if (!metaKeywords) {
      metaKeywords = document.createElement('meta')
      metaKeywords.setAttribute('name', 'keywords')
      document.head.appendChild(metaKeywords)
    }
    metaKeywords.setAttribute('content', route.keywords.join(', '))

    // Update Open Graph tags
    this.updateOpenGraphTags(route)
  }

  private updateOpenGraphTags(route: NavigationRoute): void {
    if (typeof window === 'undefined') return

    const ogTags = [
      { property: 'og:title', content: route.title },
      { property: 'og:description', content: route.description },
      { property: 'og:url', content: window.location.origin + route.path },
      { property: 'og:type', content: 'website' }
    ]

    ogTags.forEach(({ property, content }) => {
      let tag = document.querySelector(`meta[property="${property}"]`)
      if (!tag) {
        tag = document.createElement('meta')
        tag.setAttribute('property', property)
        document.head.appendChild(tag)
      }
      tag.setAttribute('content', content)
    })
  }

  getNextSection(): SectionType {
    const currentIndex = navigationRoutes.findIndex(r => r.section === this.currentRoute.section)
    const nextIndex = (currentIndex + 1) % navigationRoutes.length
    return navigationRoutes[nextIndex].section
  }

  getPreviousSection(): SectionType {
    const currentIndex = navigationRoutes.findIndex(r => r.section === this.currentRoute.section)
    const prevIndex = currentIndex === 0 ? navigationRoutes.length - 1 : currentIndex - 1
    return navigationRoutes[prevIndex].section
  }

  getSectionByIndex(index: number): SectionType | null {
    if (index >= 0 && index < navigationRoutes.length) {
      return navigationRoutes[index].section
    }
    return null
  }

  getAllRoutes(): NavigationRoute[] {
    return [...navigationRoutes]
  }

  // Event listeners
  addNavigationListener(listener: (route: NavigationRoute) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  addKeyboardListener(listener: (event: KeyboardEvent) => void): () => void {
    this.keyboardListeners.add(listener)
    return () => this.keyboardListeners.delete(listener)
  }

  // Accessibility helpers
  announceNavigation(section: SectionType): void {
    if (typeof window === 'undefined') return

    const route = this.getRouteFromSection(section)
    const announcement = `Navigated to ${route.title}`

    // Create or update screen reader announcement
    let announcer = document.getElementById('navigation-announcer')
    if (!announcer) {
      announcer = document.createElement('div')
      announcer.id = 'navigation-announcer'
      announcer.setAttribute('aria-live', 'polite')
      announcer.setAttribute('aria-atomic', 'true')
      announcer.className = 'sr-only'
      document.body.appendChild(announcer)
    }

    announcer.textContent = announcement
  }

  // Preloading helpers
  preloadSection(section: SectionType): void {
    // This could be extended to preload assets for the section
    const route = this.getRouteFromSection(section)
    console.log(`Preloading section: ${route.title}`)
  }
}

// Export singleton instance
export const navigationController = NavigationController.getInstance()
