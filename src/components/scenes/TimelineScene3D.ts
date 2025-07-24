import * as THREE from 'three'
import { BaseScene3D } from '../../lib/scene-management/BaseScene3D'
import { SceneConfig, SceneLifecycleEvents } from '../../lib/scene-management/types'
import { QualityLevel } from '../../types'
import { TimelineManager } from '../../lib/timeline-manager'
import { TimelineData, TimelineExperience } from '../../types/resume'

/**
 * 3D Timeline Scene
 * Renders the helical timeline with experience cards and smooth camera movement
 */
export class TimelineScene3D extends BaseScene3D {
  private timelineManager: TimelineManager
  private timelineData: TimelineData | null = null
  private helixCurve: THREE.CatmullRomCurve3 | null = null
  private helixLine: THREE.Line | null = null
  private experienceCards: THREE.Group[] = []
  private particleTrails: THREE.Points[] = []
  private currentCameraTime = 0
  private isAutoNavigating = false
  private autoNavigationSpeed = 0.1

  // Lighting
  private ambientLight: THREE.AmbientLight | null = null
  private directionalLight: THREE.DirectionalLight | null = null
  private pointLights: THREE.PointLight[] = []

  constructor(config: SceneConfig, lifecycleEvents?: SceneLifecycleEvents) {
    super(config, lifecycleEvents)
    this.timelineManager = TimelineManager.getInstance()
  }

  protected async onInitialize(renderer: THREE.WebGLRenderer, camera: THREE.Camera): Promise<void> {
    console.log('Initializing Timeline Scene 3D...')

    // Initialize timeline data
    this.timelineData = await this.timelineManager.initializeTimeline()

    // Setup lighting
    this.setupLighting()

    // Create helix curve visualization
    this.createHelixVisualization()

    // Create experience cards
    this.createExperienceCards()

    // Create particle trails
    this.createParticleTrails()

    // Set initial camera position
    await this.setupInitialCamera()

    console.log('Timeline Scene 3D initialized successfully')
  }

  protected async onActivate(): Promise<void> {
    console.log('Activating Timeline Scene 3D...')
    // Start auto-navigation or any scene-specific activation logic
  }

  protected async onDeactivate(): Promise<void> {
    console.log('Deactivating Timeline Scene 3D...')
    this.isAutoNavigating = false
  }

  protected onUpdate(deltaTime: number): void {
    if (!this.timelineData) return

    // Update auto-navigation
    if (this.isAutoNavigating) {
      this.updateAutoNavigation(deltaTime)
    }

    // Update particle animations
    this.updateParticleTrails(deltaTime)

    // Update experience card animations
    this.updateExperienceCards(deltaTime)
  }

  protected onBeforeRender(renderer: THREE.WebGLRenderer, camera: THREE.Camera): void {
    // Any pre-render setup
  }

  protected onAfterRender(renderer: THREE.WebGLRenderer, camera: THREE.Camera): void {
    // Any post-render cleanup
  }

  protected onResize(width: number, height: number): void {
    // Handle resize if needed
  }

  protected onCleanup(): void {
    // Cleanup timeline-specific resources
    this.experienceCards.forEach(card => {
      this.scene.remove(card)
    })
    this.experienceCards = []

    this.particleTrails.forEach(trail => {
      this.scene.remove(trail)
    })
    this.particleTrails = []

    if (this.helixLine) {
      this.scene.remove(this.helixLine)
      this.helixLine = null
    }
  }

  protected onQualityChange(level: QualityLevel): void {
    // Adjust quality-dependent features
    switch (level) {
      case QualityLevel.LOW:
        this.setLowQualitySettings()
        break
      case QualityLevel.MEDIUM:
        this.setMediumQualitySettings()
        break
      case QualityLevel.HIGH:
      case QualityLevel.ULTRA:
        this.setHighQualitySettings()
        break
    }
  }

  /**
   * Setup scene lighting
   */
  private setupLighting(): void {
    // Ambient light for overall illumination
    this.ambientLight = new THREE.AmbientLight(0x404040, 0.4)
    this.scene.add(this.ambientLight)

    // Main directional light
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    this.directionalLight.position.set(50, 50, 50)
    this.directionalLight.castShadow = true
    this.directionalLight.shadow.mapSize.width = 2048
    this.directionalLight.shadow.mapSize.height = 2048
    this.scene.add(this.directionalLight)

    // Add point lights along the helix for dramatic effect
    if (this.timelineData) {
      this.timelineData.experiences.forEach((exp, index) => {
        const pointLight = new THREE.PointLight(0x61dafb, 0.5, 20)
        pointLight.position.copy(exp.position3D)
        pointLight.position.y += 2
        this.pointLights.push(pointLight)
        this.scene.add(pointLight)
      })
    }
  }

  /**
   * Create the helix curve visualization
   */
  private createHelixVisualization(): void {
    if (!this.timelineData) return

    this.helixCurve = this.timelineData.helixConfig.curve!

    // Create helix line geometry
    const points = this.helixCurve.getPoints(200)
    const geometry = new THREE.BufferGeometry().setFromPoints(points)

    // Create gradient material for the helix
    const material = new THREE.LineBasicMaterial({
      color: 0x61dafb,
      transparent: true,
      opacity: 0.6,
      linewidth: 2
    })

    this.helixLine = new THREE.Line(geometry, material)
    this.scene.add(this.helixLine)

    // Add helix glow effect for higher quality
    if (this.qualityLevel === QualityLevel.HIGH || this.qualityLevel === QualityLevel.ULTRA) {
      const glowMaterial = new THREE.LineBasicMaterial({
        color: 0x61dafb,
        transparent: true,
        opacity: 0.2,
        linewidth: 4
      })
      const glowLine = new THREE.Line(geometry.clone(), glowMaterial)
      this.scene.add(glowLine)
    }
  }

  /**
   * Create 3D experience cards positioned along the helix
   */
  private createExperienceCards(): void {
    if (!this.timelineData) return

    this.timelineData.experiences.forEach((experience, index) => {
      const cardGroup = this.createExperienceCard(experience, index)
      this.experienceCards.push(cardGroup)
      this.scene.add(cardGroup)
    })
  }

  /**
   * Create a single experience card
   */
  private createExperienceCard(experience: TimelineExperience, index: number): THREE.Group {
    const cardGroup = new THREE.Group()

    // Card geometry - rounded rectangle
    const cardWidth = 4
    const cardHeight = 3
    const cardDepth = 0.2

    const cardGeometry = new THREE.BoxGeometry(cardWidth, cardHeight, cardDepth)

    // Glassmorphism material
    const cardMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x1a1a2e,
      transparent: true,
      opacity: 0.8,
      roughness: 0.1,
      metalness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      transmission: 0.1,
      thickness: 0.5
    })

    const cardMesh = new THREE.Mesh(cardGeometry, cardMaterial)
    cardGroup.add(cardMesh)

    // Add company name text (placeholder - would use actual text rendering)
    const textGeometry = new THREE.PlaneGeometry(3, 0.5)
    const textMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9
    })
    const textMesh = new THREE.Mesh(textGeometry, textMaterial)
    textMesh.position.set(0, 0.8, 0.11)
    cardGroup.add(textMesh)

    // Add technology indicators
    experience.technologies.slice(0, 4).forEach((tech, techIndex) => {
      const techGeometry = new THREE.SphereGeometry(0.1, 8, 8)
      const techMaterial = new THREE.MeshBasicMaterial({
        color: this.getTechnologyColor(tech)
      })
      const techMesh = new THREE.Mesh(techGeometry, techMaterial)
      techMesh.position.set(
        -1.5 + techIndex * 1,
        -0.8,
        0.15
      )
      cardGroup.add(techMesh)
    })

    // Position and rotate the card
    cardGroup.position.copy(experience.position3D)
    cardGroup.rotation.setFromVector3(experience.cardRotation)

    // Add hover animation data
    cardGroup.userData = {
      originalPosition: experience.position3D.clone(),
      originalRotation: experience.cardRotation.clone(),
      experience: experience,
      index: index,
      hoverOffset: 0,
      isHovered: false
    }

    return cardGroup
  }

  /**
   * Create particle trails connecting experience cards
   */
  private createParticleTrails(): void {
    if (!this.timelineData) return

    this.timelineData.experiences.forEach((experience, index) => {
      if (experience.connectionPoints.length > 0) {
        const trail = this.createParticleTrail(experience.connectionPoints)
        this.particleTrails.push(trail)
        this.scene.add(trail)
      }
    })
  }

  /**
   * Create a single particle trail
   */
  private createParticleTrail(points: THREE.Vector3[]): THREE.Points {
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(points.length * 3)
    const colors = new Float32Array(points.length * 3)
    const sizes = new Float32Array(points.length)

    points.forEach((point, index) => {
      positions[index * 3] = point.x
      positions[index * 3 + 1] = point.y
      positions[index * 3 + 2] = point.z

      // Gradient color along the trail
      const t = index / (points.length - 1)
      const color = new THREE.Color().lerpColors(
        new THREE.Color(0x61dafb),
        new THREE.Color(0x9f7aea),
        t
      )
      colors[index * 3] = color.r
      colors[index * 3 + 1] = color.g
      colors[index * 3 + 2] = color.b

      // Varying particle sizes
      sizes[index] = Math.random() * 2 + 1
    })

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

    const material = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    })

    return new THREE.Points(geometry, material)
  }

  /**
   * Update auto-navigation along the timeline
   */
  private updateAutoNavigation(deltaTime: number): void {
    if (!this.helixCurve) return

    this.currentCameraTime += deltaTime * this.autoNavigationSpeed
    if (this.currentCameraTime > 1) {
      this.currentCameraTime = 0
    }

    // Get position and tangent along the curve
    const position = this.helixCurve.getPoint(this.currentCameraTime)
    const tangent = this.helixCurve.getTangent(this.currentCameraTime)

    // Position camera at a distance from the curve
    const cameraDistance = 15
    const cameraOffset = new THREE.Vector3()
      .crossVectors(tangent, new THREE.Vector3(0, 1, 0))
      .normalize()
      .multiplyScalar(cameraDistance)

    const cameraPosition = position.clone().add(cameraOffset)
    cameraPosition.y += 5

    // Update camera position and target
    this.cameraPosition = cameraPosition
    this.cameraTarget = position
  }

  /**
   * Update particle trail animations
   */
  private updateParticleTrails(deltaTime: number): void {
    this.particleTrails.forEach(trail => {
      const material = trail.material as THREE.PointsMaterial
      material.opacity = 0.6 + Math.sin(Date.now() * 0.001) * 0.2
    })
  }

  /**
   * Update experience card animations
   */
  private updateExperienceCards(deltaTime: number): void {
    this.experienceCards.forEach((card, index) => {
      const userData = card.userData

      // Floating animation
      userData.hoverOffset += deltaTime * 2
      const floatOffset = Math.sin(userData.hoverOffset + index * 0.5) * 0.1

      card.position.y = userData.originalPosition.y + floatOffset

      // Gentle rotation
      card.rotation.y = userData.originalRotation.y + Math.sin(userData.hoverOffset * 0.5) * 0.1
    })
  }

  /**
   * Get color for technology
   */
  private getTechnologyColor(techName: string): number {
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
      'GraphQL': 0xe10098
    }

    return colorMap[techName] || 0x6b7280
  }

  /**
   * Setup initial camera position
   */
  private async setupInitialCamera(): Promise<void> {
    if (!this.timelineData) return

    const bounds = await this.timelineManager.getTimelineBounds()
    const optimalDistance = await this.timelineManager.getOptimalViewingDistance()

    // Position camera to view the entire timeline
    this.cameraPosition = new THREE.Vector3(
      bounds.center.x + optimalDistance * 0.7,
      bounds.center.y,
      bounds.center.z + optimalDistance * 0.7
    )
    this.cameraTarget = bounds.center
  }

  /**
   * Quality level settings
   */
  private setLowQualitySettings(): void {
    // Reduce particle count, disable shadows, etc.
    if (this.directionalLight) {
      this.directionalLight.castShadow = false
    }
  }

  private setMediumQualitySettings(): void {
    // Moderate quality settings
    if (this.directionalLight) {
      this.directionalLight.castShadow = true
      this.directionalLight.shadow.mapSize.width = 1024
      this.directionalLight.shadow.mapSize.height = 1024
    }
  }

  private setHighQualitySettings(): void {
    // Full quality settings
    if (this.directionalLight) {
      this.directionalLight.castShadow = true
      this.directionalLight.shadow.mapSize.width = 2048
      this.directionalLight.shadow.mapSize.height = 2048
    }
  }

  /**
   * Public methods for external control
   */
  public startAutoNavigation(): void {
    this.isAutoNavigating = true
  }

  public stopAutoNavigation(): void {
    this.isAutoNavigating = false
  }

  public navigateToExperience(experienceId: string): void {
    if (!this.timelineData) return

    const experience = this.timelineData.experiences.find(exp => exp.id === experienceId)
    if (!experience) return

    // Set camera to focus on specific experience
    const cameraDistance = 10
    const cameraPosition = experience.position3D.clone()
    cameraPosition.x += cameraDistance
    cameraPosition.y += 5

    this.cameraPosition = cameraPosition
    this.cameraTarget = experience.position3D
  }

  public setNavigationSpeed(speed: number): void {
    this.autoNavigationSpeed = Math.max(0.01, Math.min(1, speed))
  }
}
