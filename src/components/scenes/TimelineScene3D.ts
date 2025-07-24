import * as THREE from 'three'
import { BaseScene3D } from '../../lib/scene-management/BaseScene3D'
import { SceneConfig, SceneLifecycleEvents } from '../../lib/scene-management/types'
import { QualityLevel } from '../../types'
import { TimelineManager } from '../../lib/timeline-manager'
import { TimelineData, TimelineExperience } from '../../types/resume'
import { ParticleTrailManager, ParticleTrailConfig } from '../../lib/particle-trail-system'
import { SimpleCardRenderer, SimpleCardContent } from '../../lib/simple-card-renderer'
import { InteractiveTooltip } from '../../lib/tooltip-system'

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
  private cardContents: Map<string, SimpleCardContent> = new Map()
  private particleTrailManager: ParticleTrailManager | null = null
  private simpleCardRenderer: SimpleCardRenderer | null = null
  private tooltipSystem: InteractiveTooltip | null = null
  private currentCameraTime = 0
  private isAutoNavigating = false
  private autoNavigationSpeed = 0.1
  private mousePosition: THREE.Vector3 = new THREE.Vector3()
  private raycaster: THREE.Raycaster = new THREE.Raycaster()
  private hoveredCard: THREE.Group | null = null

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

    // Initialize simple card renderer
    this.simpleCardRenderer = new SimpleCardRenderer()

    // Initialize tooltip system
    this.tooltipSystem = new InteractiveTooltip(this.scene, camera)

    // Setup lighting
    this.setupLighting()

    // Create helix curve visualization
    this.createHelixVisualization()

    // Create experience cards with enhanced content
    this.createEnhancedExperienceCards()

    // Create enhanced particle trail system
    this.createEnhancedParticleTrails()

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

    // Update enhanced particle trails
    this.updateEnhancedParticleTrails(deltaTime)

    // Update experience card animations
    this.updateExperienceCards(deltaTime)

    // Update tooltip system
    if (this.tooltipSystem && this.hoveredCard) {
      this.tooltipSystem.updateTooltip(this.hoveredCard.position.clone())
    }
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

    // Cleanup card contents
    this.cardContents.clear()

    // Cleanup particle trail manager
    if (this.particleTrailManager) {
      this.particleTrailManager.dispose()
      this.particleTrailManager = null
    }

    // Cleanup simple card renderer
    if (this.simpleCardRenderer) {
      this.simpleCardRenderer.dispose()
      this.simpleCardRenderer = null
    }

    // Cleanup tooltip system
    if (this.tooltipSystem) {
      this.tooltipSystem.dispose()
      this.tooltipSystem = null
    }

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

    // Update particle trail quality
    if (this.particleTrailManager) {
      this.particleTrailManager.updateGlobalConfig({
        particleCount: this.getParticleCountForQuality(),
        glowIntensity: level === QualityLevel.LOW ? 0.8 : 1.2
      })
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
   * Create simple 3D experience cards
   */
  private createEnhancedExperienceCards(): void {
    if (!this.timelineData || !this.simpleCardRenderer) return

    this.timelineData.experiences.forEach((experience, index) => {
      const cardGroup = this.createSimpleExperienceCard(experience, index)
      this.experienceCards.push(cardGroup)
      this.scene.add(cardGroup)
    })
  }

  /**
   * Create a single simple experience card
   */
  private createSimpleExperienceCard(experience: TimelineExperience, index: number): THREE.Group {
    const cardGroup = new THREE.Group()

    // Create simple card content
    const cardContent = this.simpleCardRenderer!.createCard(experience)

    // Store the card content for updates
    this.cardContents.set(experience.id, cardContent)

    // Add the content group to the card
    cardGroup.add(cardContent.contentGroup)

    // Position and rotate the card
    cardGroup.position.copy(experience.position3D)
    cardGroup.rotation.setFromVector3(experience.cardRotation)

    // Enhanced user data for interactions
    cardGroup.userData = {
      originalPosition: experience.position3D.clone(),
      originalRotation: experience.cardRotation.clone(),
      experience: experience,
      index: index,
      hoverOffset: 0,
      isHovered: false,
      isSelected: false,
      cardContent: cardContent,
      animationPhase: Math.random() * Math.PI * 2
    }

    return cardGroup
  }

  /**
   * Create enhanced particle trails connecting experience cards
   */
  private createEnhancedParticleTrails(): void {
    if (!this.timelineData) return

    // Initialize particle trail manager
    const trailConfig: Partial<ParticleTrailConfig> = {
      particleCount: this.getParticleCountForQuality(),
      trailSpeed: 0.3,
      particleSize: 0.15,
      opacity: 0.8,
      glowIntensity: 1.2,
      animationSpeed: 1.0,
      colorScheme: 'tech',
      interactionRadius: 3.0
    }

    this.particleTrailManager = new ParticleTrailManager(this.scene, trailConfig)

    // Create trails between consecutive experiences
    for (let i = 0; i < this.timelineData.experiences.length - 1; i++) {
      const sourceExp = this.timelineData.experiences[i]
      const targetExp = this.timelineData.experiences[i + 1]

      const trailId = `trail_${sourceExp.id}_${targetExp.id}`
      this.particleTrailManager.createTrail(trailId, sourceExp, targetExp)
    }
  }

  /**
   * Get particle count based on quality level
   */
  private getParticleCountForQuality(): number {
    switch (this.qualityLevel) {
      case QualityLevel.LOW:
        return 20
      case QualityLevel.MEDIUM:
        return 35
      case QualityLevel.HIGH:
        return 50
      case QualityLevel.ULTRA:
        return 75
      default:
        return 35
    }
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
   * Update enhanced particle trail animations
   */
  private updateEnhancedParticleTrails(deltaTime: number): void {
    if (this.particleTrailManager) {
      this.particleTrailManager.update(deltaTime)
      this.particleTrailManager.setMousePosition(this.mousePosition)
    }
  }

  /**
   * Update simple experience card animations
   */
  private updateExperienceCards(deltaTime: number): void {
    if (!this.simpleCardRenderer) return

    this.experienceCards.forEach((card, index) => {
      const userData = card.userData

      // Update animation phase
      userData.animationPhase += deltaTime * 2
      userData.hoverOffset += deltaTime * 2

      // Floating animation with individual phase offset
      const floatOffset = Math.sin(userData.animationPhase + index * 0.5) * 0.1
      card.position.y = userData.originalPosition.y + floatOffset

      // Gentle rotation with breathing effect
      const breathingRotation = Math.sin(userData.hoverOffset * 0.5) * 0.1
      card.rotation.y = userData.originalRotation.y + breathingRotation

      // Update card content based on interaction state
      if (userData.cardContent) {
        this.simpleCardRenderer!.updateCard(
          userData.cardContent,
          userData.isHovered || false,
          userData.isSelected || false,
          deltaTime
        )
      }

      // Enhanced hover animation
      if (userData.isHovered) {
        // Slight lift and scale
        const targetY = userData.originalPosition.y + floatOffset + 0.2
        card.position.y = THREE.MathUtils.lerp(card.position.y, targetY, deltaTime * 8)

        // Add subtle tilt toward camera
        const tiltAmount = Math.sin(userData.hoverOffset * 3) * 0.05
        card.rotation.x = THREE.MathUtils.lerp(card.rotation.x, tiltAmount, deltaTime * 5)
      } else if (userData.isSelected) {
        // More pronounced animation for selected state
        const targetY = userData.originalPosition.y + floatOffset + 0.4
        card.position.y = THREE.MathUtils.lerp(card.position.y, targetY, deltaTime * 8)

        // Pulsing effect
        const pulseScale = 1 + Math.sin(userData.hoverOffset * 4) * 0.05
        card.scale.setScalar(THREE.MathUtils.lerp(card.scale.x, pulseScale, deltaTime * 10))
      } else {
        // Return to normal state
        card.rotation.x = THREE.MathUtils.lerp(card.rotation.x, 0, deltaTime * 5)
        card.scale.setScalar(THREE.MathUtils.lerp(card.scale.x, 1, deltaTime * 8))
      }
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

  /**
   * Handle mouse move for interaction effects
   */
  public onMouseMove(event: MouseEvent, camera: THREE.Camera): void {
    // Convert mouse position to world space
    const mouse = new THREE.Vector2()
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

    this.raycaster.setFromCamera(mouse, camera)

    // Update mouse position for particle effects
    const intersects = this.raycaster.ray.intersectPlane(
      new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
      this.mousePosition
    )

    if (intersects) {
      // Check for card intersections
      const cardIntersects = this.raycaster.intersectObjects(
        this.experienceCards,
        true
      )

      if (cardIntersects.length > 0) {
        const hoveredCard = cardIntersects[0].object.parent
        this.handleCardHover(hoveredCard as THREE.Group)
      } else {
        this.clearCardHover()
      }
    }
  }

  /**
   * Handle card hover state
   */
  private handleCardHover(card: THREE.Group): void {
    // Only process if this is a new hover
    if (this.hoveredCard === card) return

    // Reset all cards to idle state
    this.experienceCards.forEach(c => {
      c.userData.isHovered = false
    })

    // Set hovered card
    card.userData.isHovered = true
    this.hoveredCard = card

    // Show tooltip for hovered card
    if (this.tooltipSystem && card.userData.experience) {
      this.tooltipSystem.showTooltip(
        card.userData.experience,
        card.position.clone()
      )
    }

    // Update particle trail interactions
    if (this.particleTrailManager && card.userData.experience) {
      const expId = card.userData.experience.id

      // Find trails connected to this experience
      const trailIds = this.particleTrailManager.getTrailIds()
      trailIds.forEach(trailId => {
        if (trailId.includes(expId)) {
          this.particleTrailManager!.setTrailInteraction(trailId, 'hover')
        } else {
          this.particleTrailManager!.setTrailInteraction(trailId, 'idle')
        }
      })
    }
  }

  /**
   * Clear card hover states
   */
  private clearCardHover(): void {
    this.experienceCards.forEach(card => {
      card.userData.isHovered = false
    })

    this.hoveredCard = null

    // Hide tooltip
    if (this.tooltipSystem) {
      this.tooltipSystem.hideTooltip()
    }

    // Reset all particle trails to idle
    if (this.particleTrailManager) {
      this.particleTrailManager.setAllTrailsInteraction('idle')
    }
  }

  /**
   * Handle card click/selection
   */
  public onCardClick(card: THREE.Group): void {
    if (!card.userData.experience) return

    // Update all cards selection state
    this.experienceCards.forEach(c => {
      c.userData.isSelected = (c === card)
    })

    // Update particle trail states
    if (this.particleTrailManager) {
      const expId = card.userData.experience.id
      const trailIds = this.particleTrailManager.getTrailIds()

      trailIds.forEach(trailId => {
        if (trailId.includes(expId)) {
          this.particleTrailManager!.setTrailInteraction(trailId, 'selected')
        } else {
          this.particleTrailManager!.setTrailInteraction(trailId, 'idle')
        }
      })
    }

    // Navigate camera to selected experience
    this.navigateToExperience(card.userData.experience.id)
  }

  /**
   * Get hovered experience
   */
  public getHoveredExperience(): TimelineExperience | null {
    const hoveredCard = this.experienceCards.find(card => card.userData.isHovered)
    return hoveredCard?.userData.experience || null
  }

  /**
   * Get selected experience
   */
  public getSelectedExperience(): TimelineExperience | null {
    const selectedCard = this.experienceCards.find(card => card.userData.isSelected)
    return selectedCard?.userData.experience || null
  }
}
