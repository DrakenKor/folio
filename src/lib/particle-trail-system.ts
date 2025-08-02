import * as THREE from 'three'
import { TimelineExperience } from '../types/resume'

/**
 * Enhanced Particle Trail System
 * Creates dynamic animated particle connections between experience cards
 */

export interface ParticleTrailConfig {
  particleCount: number
  trailSpeed: number
  particleSize: number
  opacity: number
  glowIntensity: number
  animationSpeed: number
  colorScheme: 'tech' | 'temporal' | 'gradient'
  interactionRadius: number
}

export interface TrailParticle {
  position: THREE.Vector3
  velocity: THREE.Vector3
  life: number
  maxLife: number
  size: number
  color: THREE.Color
  trailIndex: number
  progress: number
}

export class EnhancedParticleTrail {
  private geometry!: THREE.BufferGeometry
  private material!: THREE.PointsMaterial
  private points!: THREE.Points
  private particles: TrailParticle[] = []
  private trailPath: THREE.Vector3[]
  private config: ParticleTrailConfig
  private time: number = 0
  private isActive: boolean = true
  private sourceExperience: TimelineExperience
  private targetExperience: TimelineExperience

  constructor(
    sourceExp: TimelineExperience,
    targetExp: TimelineExperience,
    config: Partial<ParticleTrailConfig> = {}
  ) {
    this.sourceExperience = sourceExp
    this.targetExperience = targetExp
    this.config = {
      particleCount: 50,
      trailSpeed: 0.5,
      particleSize: 0.1,
      opacity: 0.8,
      glowIntensity: 1.0,
      animationSpeed: 1.0,
      colorScheme: 'tech',
      interactionRadius: 2.0,
      ...config
    }

    this.trailPath = this.generateTrailPath()
    this.initializeParticles()
    this.createGeometry()
    this.createMaterial()
    this.points = new THREE.Points(this.geometry, this.material)
  }

  /**
   * Generate smooth curved path between experience cards
   */
  private generateTrailPath(): THREE.Vector3[] {
    const start = this.sourceExperience.position3D.clone()
    const end = this.targetExperience.position3D.clone()

    // Create curved path with control points
    const midPoint = new THREE.Vector3()
      .addVectors(start, end)
      .multiplyScalar(0.5)

    // Add upward curve for visual appeal
    midPoint.y += Math.abs(end.y - start.y) * 0.3 + 2

    // Create additional control points for smoother curve
    const quarter = new THREE.Vector3().lerpVectors(start, midPoint, 0.5)
    quarter.y += 1

    const threeQuarter = new THREE.Vector3().lerpVectors(midPoint, end, 0.5)
    threeQuarter.y += 1

    // Generate curve points using Catmull-Rom spline
    const curve = new THREE.CatmullRomCurve3([start, quarter, midPoint, threeQuarter, end])
    return curve.getPoints(100)
  }

  /**
   * Initialize particle system
   */
  private initializeParticles(): void {
    this.particles = []

    for (let i = 0; i < this.config.particleCount; i++) {
      const progress = Math.random()
      const pathIndex = Math.floor(progress * (this.trailPath.length - 1))
      const position = this.trailPath[pathIndex].clone()

      // Add slight random offset for natural appearance
      position.add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 0.2
      ))

      const particle: TrailParticle = {
        position: position,
        velocity: new THREE.Vector3(),
        life: Math.random() * 2,
        maxLife: 2 + Math.random() * 2,
        size: this.config.particleSize * (0.5 + Math.random() * 0.5),
        color: this.getParticleColor(progress),
        trailIndex: pathIndex,
        progress: progress
      }

      this.particles.push(particle)
    }
  }

  /**
   * Get particle color based on position and scheme
   */
  private getParticleColor(progress: number): THREE.Color {
    switch (this.config.colorScheme) {
      case 'tech':
        return this.getTechnologyBasedColor()

      case 'temporal':
        return this.getTemporalColor(progress)

      case 'gradient':
      default:
        return new THREE.Color().lerpColors(
          new THREE.Color(0x61dafb),
          new THREE.Color(0x9f7aea),
          progress
        )
    }
  }

  /**
   * Get color based on technology stack
   */
  private getTechnologyBasedColor(): THREE.Color {
    const technologies = [
      ...this.sourceExperience.technologies,
      ...this.targetExperience.technologies
    ]

    const techColors: Record<string, number> = {
      'React': 0x61dafb,
      'TypeScript': 0x3178c6,
      'JavaScript': 0xf7df1e,
      'Node.js': 0x339933,
      'Python': 0x3776ab,
      'Golang': 0x00add8,
      'Ruby': 0xcc342d,
      'AWS': 0xff9900,
      'Azure': 0x0078d4
    }

    // Pick a random technology color from the combined tech stack
    const randomTech = technologies[Math.floor(Math.random() * technologies.length)]
    return new THREE.Color(techColors[randomTech] || 0x61dafb)
  }

  /**
   * Get color based on temporal position
   */
  private getTemporalColor(progress: number): THREE.Color {
    // Color progression from past (blue) to future (purple)
    const startColor = new THREE.Color(0x4285f4) // Blue
    const midColor = new THREE.Color(0x61dafb)   // Cyan
    const endColor = new THREE.Color(0x9f7aea)   // Purple

    if (progress < 0.5) {
      return new THREE.Color().lerpColors(startColor, midColor, progress * 2)
    } else {
      return new THREE.Color().lerpColors(midColor, endColor, (progress - 0.5) * 2)
    }
  }

  /**
   * Create particle geometry
   */
  private createGeometry(): void {
    this.geometry = new THREE.BufferGeometry()

    const positions = new Float32Array(this.config.particleCount * 3)
    const colors = new Float32Array(this.config.particleCount * 3)
    const sizes = new Float32Array(this.config.particleCount)
    const life = new Float32Array(this.config.particleCount)

    this.updateGeometryAttributes(positions, colors, sizes, life)

    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    this.geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
    this.geometry.setAttribute('life', new THREE.BufferAttribute(life, 1))
  }

  /**
   * Update geometry attributes from particle data
   */
  private updateGeometryAttributes(
    positions: Float32Array,
    colors: Float32Array,
    sizes: Float32Array,
    life: Float32Array
  ): void {
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i]
      const i3 = i * 3

      positions[i3] = particle.position.x
      positions[i3 + 1] = particle.position.y
      positions[i3 + 2] = particle.position.z

      colors[i3] = particle.color.r
      colors[i3 + 1] = particle.color.g
      colors[i3 + 2] = particle.color.b

      sizes[i] = particle.size
      life[i] = particle.life / particle.maxLife
    }
  }

  /**
   * Create simple, performant material for particles
   */
  private createMaterial(): void {
    this.material = new THREE.PointsMaterial({
      size: this.config.particleSize,
      vertexColors: true,
      transparent: true,
      opacity: this.config.opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    })
  }

  /**
   * Update particle system animation (optimized for performance)
   */
  public update(deltaTime: number, mousePosition?: THREE.Vector3): void {
    if (!this.isActive) return

    this.time += deltaTime * this.config.animationSpeed

    // Reduce animation frequency to prevent flickering
    const shouldUpdate = Math.floor(this.time * 30) !== Math.floor((this.time - deltaTime) * 30)

    if (!shouldUpdate) return

    // Simple opacity animation (less frequent)
    this.material.opacity = this.config.opacity + Math.sin(this.time * 1) * 0.05

    // Update particles less frequently
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i]

      // Update particle life
      particle.life += deltaTime

      // Update particle progress along trail (slower)
      particle.progress += deltaTime * this.config.trailSpeed * 0.3

      if (particle.progress >= 1.0 || particle.life >= particle.maxLife) {
        // Reset particle
        particle.progress = 0
        particle.life = 0
        particle.maxLife = 3 + Math.random() * 2
        particle.color = this.getParticleColor(particle.progress)
      }

      // Update position along trail
      const pathIndex = Math.min(
        Math.floor(particle.progress * (this.trailPath.length - 1)),
        this.trailPath.length - 1
      )

      if (pathIndex < this.trailPath.length) {
        particle.position.copy(this.trailPath[pathIndex])

        // Reduce random movement to prevent flickering
        const offset = new THREE.Vector3(
          Math.sin(this.time * 0.5 + i * 0.1) * 0.05,
          Math.cos(this.time * 0.5 + i * 0.15) * 0.05,
          Math.sin(this.time * 0.5 + i * 0.2) * 0.05
        )
        particle.position.add(offset)
      }

      particle.trailIndex = pathIndex
    }

    // Update geometry (less frequently)
    const positions = this.geometry.attributes.position.array as Float32Array
    const colors = this.geometry.attributes.color.array as Float32Array
    const sizes = this.geometry.attributes.size.array as Float32Array
    const life = this.geometry.attributes.life.array as Float32Array

    this.updateGeometryAttributes(positions, colors, sizes, life)

    this.geometry.attributes.position.needsUpdate = true
    this.geometry.attributes.color.needsUpdate = true
    this.geometry.attributes.size.needsUpdate = true
    this.geometry.attributes.life.needsUpdate = true
  }

  /**
   * Set interaction state (hover, click, etc.)
   */
  public setInteractionState(state: 'idle' | 'hover' | 'selected'): void {
    switch (state) {
      case 'hover':
        this.config.animationSpeed = 1.5
        this.material.opacity = this.config.opacity * 1.2
        break
      case 'selected':
        this.config.animationSpeed = 2.0
        this.material.opacity = this.config.opacity * 1.5
        break
      case 'idle':
      default:
        this.config.animationSpeed = 1.0
        this.material.opacity = this.config.opacity
        break
    }
  }

  /**
   * Set trail activity state
   */
  public setActive(active: boolean): void {
    this.isActive = active
    this.points.visible = active
  }

  /**
   * Get the Three.js Points object for adding to scene
   */
  public getPoints(): THREE.Points {
    return this.points
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<ParticleTrailConfig>): void {
    this.config = { ...this.config, ...newConfig }

    // Update material properties
    this.material.opacity = this.config.opacity
    this.material.size = this.config.particleSize
  }

  /**
   * Get trail information
   */
  public getTrailInfo(): {
    source: TimelineExperience
    target: TimelineExperience
    particleCount: number
    isActive: boolean
  } {
    return {
      source: this.sourceExperience,
      target: this.targetExperience,
      particleCount: this.particles.length,
      isActive: this.isActive
    }
  }
}

/**
 * Particle Trail Manager
 * Manages multiple particle trails and their interactions
 */
export class ParticleTrailManager {
  private trails: Map<string, EnhancedParticleTrail> = new Map()
  private scene: THREE.Scene
  private mousePosition: THREE.Vector3 = new THREE.Vector3()
  private globalConfig: Partial<ParticleTrailConfig>

  constructor(scene: THREE.Scene, config: Partial<ParticleTrailConfig> = {}) {
    this.scene = scene
    this.globalConfig = config
  }

  /**
   * Create trail between two experiences
   */
  public createTrail(
    id: string,
    sourceExp: TimelineExperience,
    targetExp: TimelineExperience,
    config?: Partial<ParticleTrailConfig>
  ): void {
    const trailConfig = { ...this.globalConfig, ...config }
    const trail = new EnhancedParticleTrail(sourceExp, targetExp, trailConfig)

    this.trails.set(id, trail)
    this.scene.add(trail.getPoints())
  }

  /**
   * Remove trail
   */
  public removeTrail(id: string): void {
    const trail = this.trails.get(id)
    if (trail) {
      this.scene.remove(trail.getPoints())
      trail.dispose()
      this.trails.delete(id)
    }
  }

  /**
   * Update all trails
   */
  public update(deltaTime: number): void {
    for (const trail of this.trails.values()) {
      trail.update(deltaTime, this.mousePosition)
    }
  }

  /**
   * Set mouse position for interaction effects
   */
  public setMousePosition(position: THREE.Vector3): void {
    this.mousePosition.copy(position)
  }

  /**
   * Set interaction state for specific trail
   */
  public setTrailInteraction(id: string, state: 'idle' | 'hover' | 'selected'): void {
    const trail = this.trails.get(id)
    if (trail) {
      trail.setInteractionState(state)
    }
  }

  /**
   * Set all trails interaction state
   */
  public setAllTrailsInteraction(state: 'idle' | 'hover' | 'selected'): void {
    for (const trail of this.trails.values()) {
      trail.setInteractionState(state)
    }
  }

  /**
   * Update global configuration
   */
  public updateGlobalConfig(config: Partial<ParticleTrailConfig>): void {
    this.globalConfig = { ...this.globalConfig, ...config }

    for (const trail of this.trails.values()) {
      trail.updateConfig(config)
    }
  }

  /**
   * Dispose all trails
   */
  public dispose(): void {
    for (const [id, trail] of this.trails) {
      this.scene.remove(trail.getPoints())
      trail.dispose()
    }
    this.trails.clear()
  }

  /**
   * Get trail by ID
   */
  public getTrail(id: string): EnhancedParticleTrail | undefined {
    return this.trails.get(id)
  }

  /**
   * Get all trail IDs
   */
  public getTrailIds(): string[] {
    return Array.from(this.trails.keys())
  }
}
