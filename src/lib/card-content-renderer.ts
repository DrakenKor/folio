import * as THREE from 'three'
import { TimelineExperience } from '../types/resume'

/**
 * Card Content Renderer
 * Handles rendering of text content, logos, and badges on 3D experience cards
 */

export interface CardContentConfig {
  cardWidth: number
  cardHeight: number
  fontSize: {
    company: number
    position: number
    duration: number
    technology: number
  }
  colors: {
    company: string
    position: string
    duration: string
    technology: string
    background: string
  }
  spacing: {
    marginTop: number
    marginLeft: number
    lineHeight: number
    techBadgeSpacing: number
  }
}

export interface RenderedCardContent {
  companyText: THREE.Mesh
  positionText: THREE.Mesh
  durationText: THREE.Mesh
  technologyBadges: THREE.Group
  background: THREE.Mesh
  contentGroup: THREE.Group
}

export class CardContentRenderer {
  private config: CardContentConfig
  private textureLoader: THREE.TextureLoader
  private canvas: HTMLCanvasElement
  private context: CanvasRenderingContext2D

  constructor(config?: Partial<CardContentConfig>) {
    this.config = {
      cardWidth: 4,
      cardHeight: 3,
      fontSize: {
        company: 24,
        position: 18,
        duration: 14,
        technology: 12
      },
      colors: {
        company: '#ffffff',
        position: '#e2e8f0',
        duration: '#94a3b8',
        technology: '#ffffff',
        background: 'rgba(26, 26, 46, 0.9)'
      },
      spacing: {
        marginTop: 0.2,
        marginLeft: 0.2,
        lineHeight: 0.3,
        techBadgeSpacing: 0.15
      },
      ...config
    }

    this.textureLoader = new THREE.TextureLoader()
    this.canvas = document.createElement('canvas')
    this.context = this.canvas.getContext('2d')!

    // Set canvas size for high resolution text
    this.canvas.width = 512
    this.canvas.height = 384
  }

  /**
   * Render complete card content for an experience
   */
  public renderCardContent(experience: TimelineExperience): RenderedCardContent {
    const contentGroup = new THREE.Group()

    // Create card background with glassmorphism effect
    const background = this.createCardBackground()
    contentGroup.add(background)

    // Render text content
    const textTexture = this.createTextTexture(experience)
    const textMesh = this.createTextMesh(textTexture)
    contentGroup.add(textMesh)

    // Create technology badges
    const technologyBadges = this.createTechnologyBadges(experience.technologies)
    contentGroup.add(technologyBadges)

    // Create company logo placeholder (could be enhanced with actual logos)
    const companyLogo = this.createCompanyLogo(experience.company)
    contentGroup.add(companyLogo)

    return {
      companyText: textMesh,
      positionText: textMesh, // Combined in text mesh
      durationText: textMesh, // Combined in text mesh
      technologyBadges,
      background,
      contentGroup
    }
  }

  /**
   * Create enhanced glassmorphism card background
   */
  private createCardBackground(): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(this.config.cardWidth, this.config.cardHeight)

    // Enhanced glassmorphism material
    const material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x1a1a2e),
      transparent: true,
      opacity: 0.15,
      roughness: 0.1,
      metalness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      transmission: 0.8,
      thickness: 0.5,
      ior: 1.5,
      reflectivity: 0.5,
      iridescence: 0.3,
      iridescenceIOR: 1.3,
      side: THREE.DoubleSide
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.z = -0.01 // Slightly behind content

    return mesh
  }

  /**
   * Create text texture with all text content
   */
  private createTextTexture(experience: TimelineExperience): THREE.Texture {
    const ctx = this.context
    const canvas = this.canvas

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Set high DPI scaling
    const dpr = window.devicePixelRatio || 1
    const scale = 2 * dpr
    ctx.scale(scale, scale)

    // Configure text rendering
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillStyle = 'white'

    let yOffset = 20

    // Company name (largest, bold)
    ctx.font = `bold ${this.config.fontSize.company}px 'Arial', sans-serif`
    ctx.fillStyle = this.config.colors.company
    ctx.fillText(experience.company, 20, yOffset)
    yOffset += this.config.fontSize.company + 10

    // Position title
    ctx.font = `${this.config.fontSize.position}px 'Arial', sans-serif`
    ctx.fillStyle = this.config.colors.position
    const wrappedPosition = this.wrapText(ctx, experience.position, canvas.width - 40)
    wrappedPosition.forEach(line => {
      ctx.fillText(line, 20, yOffset)
      yOffset += this.config.fontSize.position + 5
    })
    yOffset += 10

    // Duration
    ctx.font = `${this.config.fontSize.duration}px 'Arial', sans-serif`
    ctx.fillStyle = this.config.colors.duration
    const startYear = experience.startDate.getFullYear()
    const endYear = experience.endDate?.getFullYear() || 'Present'
    const duration = `${startYear} - ${endYear}`
    ctx.fillText(duration, 20, yOffset)
    yOffset += 30

    // Location
    ctx.fillText(experience.location, 20, yOffset)
    yOffset += 25

    // Company type
    ctx.font = `italic ${this.config.fontSize.duration - 2}px 'Arial', sans-serif`
    ctx.fillStyle = this.config.colors.duration
    ctx.fillText(experience.companyType, 20, yOffset)

    // Reset scale
    ctx.setTransform(1, 0, 0, 1, 0, 0)

    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas)
    texture.generateMipmaps = false
    texture.wrapS = THREE.ClampToEdgeWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter

    return texture
  }

  /**
   * Wrap text to fit within specified width
   */
  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(' ')
    const lines: string[] = []
    let currentLine = ''

    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word
      const metrics = ctx.measureText(testLine)

      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine)
        currentLine = word
      } else {
        currentLine = testLine
      }
    }

    if (currentLine) {
      lines.push(currentLine)
    }

    return lines
  }

  /**
   * Create text mesh from texture
   */
  private createTextMesh(texture: THREE.Texture): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(this.config.cardWidth * 0.9, this.config.cardHeight * 0.9)
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.z = 0.01 // Slightly in front of background

    return mesh
  }

  /**
   * Create 3D technology badges
   */
  private createTechnologyBadges(technologies: string[]): THREE.Group {
    const badgeGroup = new THREE.Group()
    const maxBadges = 6 // Limit to prevent overcrowding
    const visibleTechs = technologies.slice(0, maxBadges)

    visibleTechs.forEach((tech, index) => {
      const badge = this.createTechnologyBadge(tech, index)
      badgeGroup.add(badge)
    })

    // Position badges at the bottom of the card
    badgeGroup.position.y = -this.config.cardHeight * 0.35
    badgeGroup.position.z = 0.02

    return badgeGroup
  }

  /**
   * Create individual technology badge
   */
  private createTechnologyBadge(technology: string, index: number): THREE.Group {
    const badgeGroup = new THREE.Group()

    // Badge background
    const badgeWidth = 0.8
    const badgeHeight = 0.25
    const badgeGeometry = new THREE.PlaneGeometry(badgeWidth, badgeHeight)

    const badgeColor = this.getTechnologyColor(technology)
    const badgeMaterial = new THREE.MeshBasicMaterial({
      color: badgeColor,
      transparent: true,
      opacity: 0.8
    })

    const badgeBackground = new THREE.Mesh(badgeGeometry, badgeMaterial)
    badgeGroup.add(badgeBackground)

    // Badge text
    const badgeTexture = this.createBadgeTexture(technology)
    const badgeTextGeometry = new THREE.PlaneGeometry(badgeWidth * 0.9, badgeHeight * 0.7)
    const badgeTextMaterial = new THREE.MeshBasicMaterial({
      map: badgeTexture,
      transparent: true
    })

    const badgeText = new THREE.Mesh(badgeTextGeometry, badgeTextMaterial)
    badgeText.position.z = 0.001
    badgeGroup.add(badgeText)

    // Position badges in a grid
    const badgesPerRow = 3
    const row = Math.floor(index / badgesPerRow)
    const col = index % badgesPerRow

    badgeGroup.position.x = (col - 1) * (badgeWidth + this.config.spacing.techBadgeSpacing)
    badgeGroup.position.y = -row * (badgeHeight + this.config.spacing.techBadgeSpacing)

    return badgeGroup
  }

  /**
   * Create texture for technology badge text
   */
  private createBadgeTexture(technology: string): THREE.Texture {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    canvas.width = 128
    canvas.height = 32

    ctx.fillStyle = 'white'
    ctx.font = 'bold 12px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Truncate long technology names
    const displayText = technology.length > 10 ? technology.substring(0, 10) + '...' : technology
    ctx.fillText(displayText, canvas.width / 2, canvas.height / 2)

    const texture = new THREE.CanvasTexture(canvas)
    texture.generateMipmaps = false
    texture.minFilter = THREE.LinearFilter

    return texture
  }

  /**
   * Get color for technology badge
   */
  private getTechnologyColor(technology: string): THREE.Color {
    const colorMap: Record<string, number> = {
      'React': 0x61dafb,
      'TypeScript': 0x3178c6,
      'JavaScript': 0xf7df1e,
      'Node.js': 0x339933,
      'Python': 0x3776ab,
      'Golang': 0x00add8,
      'Ruby': 0xcc342d,
      'PostgreSQL': 0x336791,
      'AWS': 0xff9900,
      'Azure': 0x0078d4,
      'Docker': 0x2496ed,
      'GraphQL': 0xe10098,
      'Svelte': 0xff3e00,
      'Terraform': 0x623ce4
    }

    return new THREE.Color(colorMap[technology] || 0x6b7280)
  }

  /**
   * Create company logo placeholder
   */
  private createCompanyLogo(companyName: string): THREE.Mesh {
    // For now, create a circular logo placeholder
    // This could be enhanced to load actual company logos
    const logoGeometry = new THREE.CircleGeometry(0.3, 16)
    const logoMaterial = new THREE.MeshBasicMaterial({
      color: 0x4a5568,
      transparent: true,
      opacity: 0.7
    })

    const logoMesh = new THREE.Mesh(logoGeometry, logoMaterial)
    logoMesh.position.set(this.config.cardWidth * 0.35, this.config.cardHeight * 0.35, 0.015)

    // Add company initial
    const initialTexture = this.createCompanyInitialTexture(companyName)
    const initialGeometry = new THREE.PlaneGeometry(0.4, 0.4)
    const initialMaterial = new THREE.MeshBasicMaterial({
      map: initialTexture,
      transparent: true
    })

    const initialMesh = new THREE.Mesh(initialGeometry, initialMaterial)
    initialMesh.position.copy(logoMesh.position)
    initialMesh.position.z += 0.001

    const logoGroup = new THREE.Group()
    logoGroup.add(logoMesh)
    logoGroup.add(initialMesh)

    return logoGroup as any as THREE.Mesh // Type cast for interface compatibility
  }

  /**
   * Create texture for company initial
   */
  private createCompanyInitialTexture(companyName: string): THREE.Texture {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    canvas.width = 64
    canvas.height = 64

    ctx.fillStyle = 'white'
    ctx.font = 'bold 32px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const initial = companyName.charAt(0).toUpperCase()
    ctx.fillText(initial, canvas.width / 2, canvas.height / 2)

    const texture = new THREE.CanvasTexture(canvas)
    texture.generateMipmaps = false
    texture.minFilter = THREE.LinearFilter

    return texture
  }

  /**
   * Update card content for animations
   */
  public updateCardContent(
    renderedContent: RenderedCardContent,
    hoverState: boolean,
    selectedState: boolean,
    deltaTime: number
  ): void {
    const { contentGroup, background } = renderedContent

    // Animate based on interaction state
    if (hoverState) {
      // Enhance glassmorphism effect on hover
      const material = background.material as THREE.MeshPhysicalMaterial
      material.transmission = THREE.MathUtils.lerp(material.transmission, 0.9, deltaTime * 5)
      material.iridescence = THREE.MathUtils.lerp(material.iridescence, 0.5, deltaTime * 5)

      // Subtle scale animation
      contentGroup.scale.setScalar(THREE.MathUtils.lerp(contentGroup.scale.x, 1.05, deltaTime * 8))
    } else if (selectedState) {
      // More pronounced effect for selection
      const material = background.material as THREE.MeshPhysicalMaterial
      material.transmission = THREE.MathUtils.lerp(material.transmission, 1.0, deltaTime * 5)
      material.iridescence = THREE.MathUtils.lerp(material.iridescence, 0.7, deltaTime * 5)

      contentGroup.scale.setScalar(THREE.MathUtils.lerp(contentGroup.scale.x, 1.1, deltaTime * 8))
    } else {
      // Return to normal state
      const material = background.material as THREE.MeshPhysicalMaterial
      material.transmission = THREE.MathUtils.lerp(material.transmission, 0.8, deltaTime * 5)
      material.iridescence = THREE.MathUtils.lerp(material.iridescence, 0.3, deltaTime * 5)

      contentGroup.scale.setScalar(THREE.MathUtils.lerp(contentGroup.scale.x, 1.0, deltaTime * 8))
    }
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    // Clean up canvas and context
    this.canvas.remove()
  }
}
