import * as THREE from 'three'
import { TimelineExperience } from '../types/resume'

/**
 * Interactive Tooltip System
 * Creates detailed information tooltips for timeline experience cards
 */

export interface TooltipConfig {
  maxWidth: number
  maxHeight: number
  backgroundColor: string
  textColor: string
  borderColor: string
  fontSize: {
    title: number
    subtitle: number
    body: number
    tech: number
  }
  spacing: {
    padding: number
    lineHeight: number
    sectionSpacing: number
  }
  animation: {
    fadeInDuration: number
    scaleInDuration: number
    followSpeed: number
  }
}

export interface TooltipContent {
  backgroundMesh: THREE.Mesh
  textMesh: THREE.Mesh
  connectorLine: THREE.Line
  tooltipGroup: THREE.Group
  isVisible: boolean
  targetPosition: THREE.Vector3
  currentPosition: THREE.Vector3
}

export class InteractiveTooltip {
  private config: TooltipConfig
  private canvas: HTMLCanvasElement
  private context: CanvasRenderingContext2D
  private tooltip: TooltipContent | null = null
  private currentExperience: TimelineExperience | null = null
  private scene: THREE.Scene
  private camera: THREE.Camera
  private animationId: number | null = null

  constructor(scene: THREE.Scene, camera: THREE.Camera, config?: Partial<TooltipConfig>) {
    this.scene = scene
    this.camera = camera
    this.config = {
      maxWidth: 400,
      maxHeight: 300,
      backgroundColor: 'rgba(26, 26, 46, 0.95)',
      textColor: '#ffffff',
      borderColor: '#61dafb',
      fontSize: {
        title: 18,
        subtitle: 14,
        body: 12,
        tech: 10
      },
      spacing: {
        padding: 16,
        lineHeight: 18,
        sectionSpacing: 12
      },
      animation: {
        fadeInDuration: 0.3,
        scaleInDuration: 0.2,
        followSpeed: 8
      },
      ...config
    }

    this.canvas = document.createElement('canvas')
    this.context = this.canvas.getContext('2d')!
    this.canvas.width = this.config.maxWidth
    this.canvas.height = this.config.maxHeight
  }

  /**
   * Show tooltip for an experience
   */
  public showTooltip(
    experience: TimelineExperience,
    worldPosition: THREE.Vector3,
    mousePosition?: THREE.Vector2
  ): void {
    this.currentExperience = experience

    if (this.tooltip) {
      this.hideTooltip()
    }

    // Create tooltip content
    this.tooltip = this.createTooltipContent(experience)

    // Position tooltip
    this.positionTooltip(worldPosition, mousePosition)

    // Add to scene
    this.scene.add(this.tooltip.tooltipGroup)

    // Animate in
    this.animateTooltipIn()
  }

  /**
   * Hide tooltip
   */
  public hideTooltip(): void {
    if (!this.tooltip) return

    this.animateTooltipOut(() => {
      if (this.tooltip) {
        this.scene.remove(this.tooltip.tooltipGroup)
        this.tooltip.backgroundMesh.geometry.dispose()
        ;(this.tooltip.backgroundMesh.material as THREE.MeshBasicMaterial).dispose()
        this.tooltip.textMesh.geometry.dispose()
        ;(this.tooltip.textMesh.material as THREE.MeshBasicMaterial).map?.dispose()
        ;(this.tooltip.textMesh.material as THREE.MeshBasicMaterial).dispose()
        this.tooltip = null
      }
      this.currentExperience = null
    })
  }

  /**
   * Update tooltip position (for following mouse or card)
   */
  public updateTooltip(worldPosition?: THREE.Vector3, mousePosition?: THREE.Vector2): void {
    if (!this.tooltip || !this.currentExperience) return

    if (worldPosition) {
      this.tooltip.targetPosition.copy(worldPosition)
    }

    // Smooth following animation
    this.tooltip.currentPosition.lerp(
      this.tooltip.targetPosition,
      this.config.animation.followSpeed * 0.016 // Assume 60fps
    )

    this.tooltip.tooltipGroup.position.copy(this.tooltip.currentPosition)
  }

  /**
   * Create tooltip content
   */
  private createTooltipContent(experience: TimelineExperience): TooltipContent {
    const tooltipGroup = new THREE.Group()

    // Create text texture
    const textTexture = this.createTooltipTexture(experience)

    // Measure content for sizing
    const contentSize = this.measureTooltipContent(experience)

    // Create background
    const backgroundMesh = this.createTooltipBackground(contentSize.width, contentSize.height)
    tooltipGroup.add(backgroundMesh)

    // Create text mesh
    const textGeometry = new THREE.PlaneGeometry(contentSize.width, contentSize.height)
    const textMaterial = new THREE.MeshBasicMaterial({
      map: textTexture,
      transparent: true,
      side: THREE.DoubleSide
    })
    const textMesh = new THREE.Mesh(textGeometry, textMaterial)
    textMesh.position.z = 0.01
    tooltipGroup.add(textMesh)

    // Create connector line from card to tooltip
    const connectorLine = this.createConnectorLine()
    tooltipGroup.add(connectorLine)

    const targetPosition = experience.position3D.clone()
    targetPosition.y += 3 // Position above the card

    return {
      backgroundMesh,
      textMesh,
      connectorLine,
      tooltipGroup,
      isVisible: false,
      targetPosition,
      currentPosition: targetPosition.clone()
    }
  }

  /**
   * Create tooltip background with border
   */
  private createTooltipBackground(width: number, height: number): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(width, height)

    // Create background with border effect
    const material = new THREE.MeshBasicMaterial({
      color: 0x1a1a2e,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide
    })

    const mesh = new THREE.Mesh(geometry, material)

    // Add border
    const borderGeometry = new THREE.EdgesGeometry(geometry)
    const borderMaterial = new THREE.LineBasicMaterial({
      color: 0x61dafb,
      transparent: true,
      opacity: 0.8
    })
    const borderMesh = new THREE.LineSegments(borderGeometry, borderMaterial)
    mesh.add(borderMesh)

    return mesh
  }

  /**
   * Create connector line from card to tooltip
   */
  private createConnectorLine(): THREE.Line {
    const points = [
      new THREE.Vector3(0, -1, 0), // Start at tooltip bottom
      new THREE.Vector3(0, -2, 0)  // End pointing toward card
    ]

    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const material = new THREE.LineBasicMaterial({
      color: 0x61dafb,
      transparent: true,
      opacity: 0.6
    })

    return new THREE.Line(geometry, material)
  }

  /**
   * Create detailed tooltip texture
   */
  private createTooltipTexture(experience: TimelineExperience): THREE.Texture {
    const ctx = this.context
    const canvas = this.canvas

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Set text properties
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'

    let yOffset = this.config.spacing.padding

    // Company name and position (title)
    ctx.font = `bold ${this.config.fontSize.title}px Arial`
    ctx.fillStyle = this.config.textColor
    ctx.fillText(experience.company, this.config.spacing.padding, yOffset)
    yOffset += this.config.fontSize.title + 4

    ctx.font = `${this.config.fontSize.subtitle}px Arial`
    ctx.fillStyle = '#e2e8f0'
    const wrappedPosition = this.wrapText(
      ctx,
      experience.position,
      canvas.width - this.config.spacing.padding * 2
    )
    wrappedPosition.forEach(line => {
      ctx.fillText(line, this.config.spacing.padding, yOffset)
      yOffset += this.config.spacing.lineHeight
    })
    yOffset += this.config.spacing.sectionSpacing

    // Duration and location
    ctx.font = `${this.config.fontSize.body}px Arial`
    ctx.fillStyle = '#94a3b8'
    const startYear = experience.startDate.getFullYear()
    const endYear = experience.endDate?.getFullYear() || 'Present'
    ctx.fillText(`${startYear} - ${endYear}`, this.config.spacing.padding, yOffset)
    yOffset += this.config.spacing.lineHeight

    ctx.fillText(experience.location, this.config.spacing.padding, yOffset)
    yOffset += this.config.spacing.lineHeight

    ctx.fillText(experience.companyType, this.config.spacing.padding, yOffset)
    yOffset += this.config.spacing.sectionSpacing

    // Description
    if (experience.description) {
      ctx.font = `${this.config.fontSize.body}px Arial`
      ctx.fillStyle = '#d1d5db'
      const wrappedDescription = this.wrapText(
        ctx,
        experience.description,
        canvas.width - this.config.spacing.padding * 2
      )
      wrappedDescription.forEach(line => {
        ctx.fillText(line, this.config.spacing.padding, yOffset)
        yOffset += this.config.spacing.lineHeight
      })
      yOffset += this.config.spacing.sectionSpacing
    }

    // Technologies section
    if (experience.technologies.length > 0) {
      ctx.font = `bold ${this.config.fontSize.body}px Arial`
      ctx.fillStyle = '#61dafb'
      ctx.fillText('Technologies:', this.config.spacing.padding, yOffset)
      yOffset += this.config.spacing.lineHeight + 4

      // Technology badges
      ctx.font = `${this.config.fontSize.tech}px Arial`
      let xOffset = this.config.spacing.padding
      const badgeHeight = 16
      const badgeSpacing = 6

      experience.technologies.forEach((tech, index) => {
        const badgeWidth = ctx.measureText(tech).width + 12

        // Check if we need to wrap to next line
        if (xOffset + badgeWidth > canvas.width - this.config.spacing.padding) {
          xOffset = this.config.spacing.padding
          yOffset += badgeHeight + badgeSpacing
        }

        // Draw tech badge background
        ctx.fillStyle = this.getTechBadgeColor(tech)
        ctx.fillRect(xOffset, yOffset - 2, badgeWidth, badgeHeight)

        // Draw tech badge text
        ctx.fillStyle = 'white'
        ctx.fillText(tech, xOffset + 6, yOffset + 2)

        xOffset += badgeWidth + badgeSpacing
      })
      yOffset += badgeHeight + this.config.spacing.sectionSpacing
    }

    // Key achievements
    if (experience.achievements && experience.achievements.length > 0) {
      ctx.font = `bold ${this.config.fontSize.body}px Arial`
      ctx.fillStyle = '#9f7aea'
      ctx.fillText('Key Achievements:', this.config.spacing.padding, yOffset)
      yOffset += this.config.spacing.lineHeight + 4

      ctx.font = `${this.config.fontSize.body}px Arial`
      ctx.fillStyle = '#d1d5db'

      experience.achievements.slice(0, 3).forEach(achievement => {
        ctx.fillText('•', this.config.spacing.padding, yOffset)
        const wrappedAchievement = this.wrapText(
          ctx,
          achievement,
          canvas.width - this.config.spacing.padding * 2 - 20
        )
        wrappedAchievement.forEach((line, lineIndex) => {
          ctx.fillText(
            line,
            this.config.spacing.padding + 16,
            yOffset + lineIndex * this.config.spacing.lineHeight
          )
        })
        yOffset += wrappedAchievement.length * this.config.spacing.lineHeight + 4
      })
    }

    // Create texture
    const texture = new THREE.CanvasTexture(canvas)
    texture.generateMipmaps = false
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter

    return texture
  }

  /**
   * Measure tooltip content dimensions
   */
  private measureTooltipContent(experience: TimelineExperience): { width: number; height: number } {
    // Calculate based on content - simplified for now
    const baseHeight = 200
    const techHeight = Math.ceil(experience.technologies.length / 4) * 25
    const achievementHeight = experience.achievements ? experience.achievements.length * 20 : 0

    return {
      width: Math.min(this.config.maxWidth * 0.8, 6), // 3D units
      height: Math.min((baseHeight + techHeight + achievementHeight) / 100, 4) // Convert to 3D units
    }
  }

  /**
   * Get technology badge color
   */
  private getTechBadgeColor(tech: string): string {
    const colors: Record<string, string> = {
      'React': '#61dafb',
      'TypeScript': '#3178c6',
      'JavaScript': '#f7df1e',
      'Node.js': '#339933',
      'Python': '#3776ab',
      'Golang': '#00add8',
      'Ruby': '#cc342d',
      'PostgreSQL': '#336791',
      'AWS': '#ff9900',
      'Azure': '#0078d4',
      'Docker': '#2496ed',
      'GraphQL': '#e10098'
    }
    return colors[tech] || '#6b7280'
  }

  /**
   * Wrap text to fit within width
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
   * Position tooltip relative to world position
   */
  private positionTooltip(worldPosition: THREE.Vector3, mousePosition?: THREE.Vector2): void {
    if (!this.tooltip) return

    // Position tooltip above and to the side of the card
    const offset = new THREE.Vector3(3, 2, 0)
    this.tooltip.targetPosition.copy(worldPosition).add(offset)
    this.tooltip.currentPosition.copy(this.tooltip.targetPosition)
    this.tooltip.tooltipGroup.position.copy(this.tooltip.currentPosition)
  }

  /**
   * Animate tooltip in
   */
  private animateTooltipIn(): void {
    if (!this.tooltip) return

    this.tooltip.isVisible = true
    this.tooltip.tooltipGroup.scale.setScalar(0)
    ;(this.tooltip.backgroundMesh.material as THREE.MeshBasicMaterial).opacity = 0
    ;(this.tooltip.textMesh.material as THREE.MeshBasicMaterial).opacity = 0

    // Scale and fade in animation
    const startTime = Date.now()
    const animate = () => {
      if (!this.tooltip) return

      const elapsed = (Date.now() - startTime) / 1000
      const scaleProgress = Math.min(elapsed / this.config.animation.scaleInDuration, 1)
      const fadeProgress = Math.min(elapsed / this.config.animation.fadeInDuration, 1)

      // Eased scale animation
      const easeScale = this.easeOutBack(scaleProgress)
      this.tooltip.tooltipGroup.scale.setScalar(easeScale)

      // Fade in
      ;(this.tooltip.backgroundMesh.material as THREE.MeshBasicMaterial).opacity = fadeProgress * 0.95
      ;(this.tooltip.textMesh.material as THREE.MeshBasicMaterial).opacity = fadeProgress

      if (scaleProgress < 1 || fadeProgress < 1) {
        this.animationId = requestAnimationFrame(animate)
      } else {
        this.animationId = null
      }
    }

    animate()
  }

  /**
   * Animate tooltip out
   */
  private animateTooltipOut(onComplete: () => void): void {
    if (!this.tooltip) {
      onComplete()
      return
    }

    this.tooltip.isVisible = false

    const startTime = Date.now()
    const animate = () => {
      if (!this.tooltip) {
        onComplete()
        return
      }

      const elapsed = (Date.now() - startTime) / 1000
      const progress = Math.min(elapsed / this.config.animation.fadeInDuration, 1)
      const opacity = 1 - progress
      const scale = 1 - progress * 0.2

      this.tooltip.tooltipGroup.scale.setScalar(scale)
      ;(this.tooltip.backgroundMesh.material as THREE.MeshBasicMaterial).opacity = opacity * 0.95
      ;(this.tooltip.textMesh.material as THREE.MeshBasicMaterial).opacity = opacity

      if (progress < 1) {
        this.animationId = requestAnimationFrame(animate)
      } else {
        this.animationId = null
        onComplete()
      }
    }

    animate()
  }

  /**
   * Easing function for smooth animations
   */
  private easeOutBack(t: number): number {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  }

  /**
   * Check if tooltip is currently visible
   */
  public isVisible(): boolean {
    return this.tooltip?.isVisible || false
  }

  /**
   * Get current experience being displayed
   */
  public getCurrentExperience(): TimelineExperience | null {
    return this.currentExperience
  }

  /**
   * Dispose of tooltip system
   */
  public dispose(): void {
    this.hideTooltip()
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
    }
    this.canvas.remove()
  }
}
