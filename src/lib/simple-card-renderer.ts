import * as THREE from 'three'
import { TimelineExperience } from '../types/resume'

/**
 * Simple Card Renderer
 * Optimized version for performance and stability
 */

export interface SimpleCardContent {
  cardMesh: THREE.Mesh
  frontTextMesh: THREE.Mesh
  backTextMesh: THREE.Mesh
  techBadges: THREE.Mesh[]
  contentGroup: THREE.Group
}

export class SimpleCardRenderer {
  private textureCache: Map<string, THREE.Texture> = new Map()

  /**
   * Create a simple, performant experience card
   */
  public createCard(experience: TimelineExperience): SimpleCardContent {
    const contentGroup = new THREE.Group()

    // Simple card background
    const cardMesh = this.createCardBackground()
    contentGroup.add(cardMesh)

    // Create double-sided text display
    const { frontTextMesh, backTextMesh } = this.createDoubleSidedTextDisplay(experience)
    contentGroup.add(frontTextMesh)
    contentGroup.add(backTextMesh)

    // Simple tech indicators
    const techBadges = this.createTechIndicators(experience.technologies)
    techBadges.forEach(badge => contentGroup.add(badge))

    return {
      cardMesh,
      frontTextMesh,
      backTextMesh,
      techBadges,
      contentGroup
    }
  }

  /**
   * Create simple card background (larger size)
   */
  private createCardBackground(): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(6, 4, 0.3)

    // Simple glassmorphism material (double-sided so you can see the back text)
    const material = new THREE.MeshBasicMaterial({
      color: 0x1a1a2e,
      transparent: true,
      opacity: 0.6, // More transparent so back text shows through
      side: THREE.DoubleSide
    })

    return new THREE.Mesh(geometry, material)
  }

  /**
   * Create simple double-sided text display
   */
  private createDoubleSidedTextDisplay(experience: TimelineExperience): {
    frontTextMesh: THREE.Mesh
    backTextMesh: THREE.Mesh
  } {
    // Use cached texture if available
    const cacheKey = `${experience.id}-text`
    let texture = this.textureCache.get(cacheKey)

    if (!texture) {
      texture = this.createSimpleTextTexture(experience)
      this.textureCache.set(cacheKey, texture)
    }

    // Create single geometry for double-sided rendering
    const geometry = new THREE.PlaneGeometry(5.8, 3.8)

    // Double-sided material - this should render on both sides
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide // This makes it render on both front and back
    })

    // Create single mesh that renders on both sides
    const textMesh = new THREE.Mesh(geometry, material)
    textMesh.position.z = 0.16

    // Return the same mesh for both front and back for compatibility
    return {
      frontTextMesh: textMesh,
      backTextMesh: textMesh
    }
  }

  /**
   * Create simple text texture (larger for bigger cards)
   */
  private createSimpleTextTexture(experience: TimelineExperience): THREE.Texture {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    canvas.width = 384
    canvas.height = 256

    // Clear background
    ctx.fillStyle = 'rgba(0,0,0,0)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Company name (larger font for bigger cards)
    ctx.fillStyle = 'white'
    ctx.font = 'bold 28px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(experience.company, canvas.width / 2, 40)

    // Position
    ctx.font = '20px Arial'
    ctx.fillStyle = '#e2e8f0'
    this.wrapAndDrawText(ctx, experience.position, canvas.width / 2, 75, 340, 24)

    // Duration
    ctx.font = '16px Arial'
    ctx.fillStyle = '#94a3b8'
    const startYear = experience.startDate.getFullYear()
    const endYear = experience.endDate?.getFullYear() || 'Present'
    ctx.fillText(`${startYear} - ${endYear}`, canvas.width / 2, 150)

    // Location
    ctx.fillText(experience.location, canvas.width / 2, 175)

    // Company type
    ctx.font = '14px Arial'
    ctx.fillStyle = '#94a3b8'
    ctx.fillText(experience.companyType, canvas.width / 2, 195)

    const texture = new THREE.CanvasTexture(canvas)
    texture.generateMipmaps = false
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter

    return texture
  }

  /**
   * Wrap and draw text
   */
  private wrapAndDrawText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ): void {
    const words = text.split(' ')
    let line = ''
    let currentY = y

    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' '
      const metrics = ctx.measureText(testLine)

      if (metrics.width > maxWidth && i > 0) {
        ctx.fillText(line, x, currentY)
        line = words[i] + ' '
        currentY += lineHeight
      } else {
        line = testLine
      }
    }
    ctx.fillText(line, x, currentY)
  }

  /**
   * Create simple technology indicators (positioned for larger cards)
   */
  private createTechIndicators(technologies: string[]): THREE.Mesh[] {
    const indicators: THREE.Mesh[] = []
    const maxTech = 6 // Show more tech indicators for larger cards
    const visibleTech = technologies.slice(0, maxTech)

    visibleTech.forEach((tech, index) => {
      const geometry = new THREE.SphereGeometry(0.15, 12, 12) // Larger spheres
      const material = new THREE.MeshBasicMaterial({
        color: this.getTechColor(tech)
      })

      const mesh = new THREE.Mesh(geometry, material)

      // Arrange in two rows for better layout
      const techsPerRow = 3
      const row = Math.floor(index / techsPerRow)
      const col = index % techsPerRow

      mesh.position.set(
        -1.2 + col * 1.2, // Spread out more horizontally
        -1.4 - row * 0.4, // Two rows
        0.2
      )

      indicators.push(mesh)
    })

    return indicators
  }

  /**
   * Get technology color
   */
  private getTechColor(tech: string): number {
    const colors: Record<string, number> = {
      'React': 0x61dafb,
      'TypeScript': 0x3178c6,
      'JavaScript': 0xf7df1e,
      'Node.js': 0x339933,
      'Python': 0x3776ab,
      'Golang': 0x00add8,
      'Ruby': 0xcc342d,
      'PostgreSQL': 0x336791,
      'AWS': 0xff9900,
      'Azure': 0x0078d4
    }
    return colors[tech] || 0x6b7280
  }

  /**
   * Update card animations (simplified, handles double-sided text)
   */
  public updateCard(
    cardContent: SimpleCardContent,
    isHovered: boolean,
    isSelected: boolean,
    deltaTime: number
  ): void {
    const { cardMesh, frontTextMesh, backTextMesh, contentGroup } = cardContent

    // Simple hover effect
    if (isHovered) {
      const material = cardMesh.material as THREE.MeshBasicMaterial
      material.opacity = THREE.MathUtils.lerp(material.opacity, 0.9, deltaTime * 5)
      contentGroup.scale.setScalar(THREE.MathUtils.lerp(contentGroup.scale.x, 1.05, deltaTime * 8))

      // Enhance text visibility on hover
      const frontMaterial = frontTextMesh.material as THREE.MeshBasicMaterial
      const backMaterial = backTextMesh.material as THREE.MeshBasicMaterial
      frontMaterial.opacity = THREE.MathUtils.lerp(frontMaterial.opacity, 1.0, deltaTime * 5)
      backMaterial.opacity = THREE.MathUtils.lerp(backMaterial.opacity, 1.0, deltaTime * 5)
    } else if (isSelected) {
      const material = cardMesh.material as THREE.MeshBasicMaterial
      material.opacity = THREE.MathUtils.lerp(material.opacity, 1.0, deltaTime * 5)
      contentGroup.scale.setScalar(THREE.MathUtils.lerp(contentGroup.scale.x, 1.1, deltaTime * 8))

      // Full text visibility when selected
      const frontMaterial = frontTextMesh.material as THREE.MeshBasicMaterial
      const backMaterial = backTextMesh.material as THREE.MeshBasicMaterial
      frontMaterial.opacity = THREE.MathUtils.lerp(frontMaterial.opacity, 1.0, deltaTime * 5)
      backMaterial.opacity = THREE.MathUtils.lerp(backMaterial.opacity, 1.0, deltaTime * 5)
    } else {
      const material = cardMesh.material as THREE.MeshBasicMaterial
      material.opacity = THREE.MathUtils.lerp(material.opacity, 0.8, deltaTime * 5)
      contentGroup.scale.setScalar(THREE.MathUtils.lerp(contentGroup.scale.x, 1.0, deltaTime * 8))

      // Normal text visibility
      const frontMaterial = frontTextMesh.material as THREE.MeshBasicMaterial
      const backMaterial = backTextMesh.material as THREE.MeshBasicMaterial
      frontMaterial.opacity = THREE.MathUtils.lerp(frontMaterial.opacity, 0.9, deltaTime * 5)
      backMaterial.opacity = THREE.MathUtils.lerp(backMaterial.opacity, 0.9, deltaTime * 5)
    }
  }

  /**
   * Dispose of cached resources
   */
  public dispose(): void {
    for (const texture of this.textureCache.values()) {
      texture.dispose()
    }
    this.textureCache.clear()
  }
}
