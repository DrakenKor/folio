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

  // Enhanced auto-navigation with smooth helix following
  private currentExperienceIndex = 0
  private isPausedAtExperience = false
  private pauseStartTime = 0
  private pauseDuration = 3000 // 3 seconds pause at each experience
  private transitionDuration = 2000 // 2 seconds transition between experiences
  private isTransitioningToNext = false
  private transitionStartTime = 0
  private onExperienceSelectCallback: ((experience: TimelineExperience) => void) | null = null

  // Smooth helix navigation
  private helixNavigationProgress = 0 // 0 to 1 along the entire helix
  private smoothNavigationSpeed = 0.05 // Speed of helix traversal
  private cameraHeightOffset = 0 // Height offset from helix curve
  private cameraRadiusOffset = -0.5 // Radius offset from helix curve (inside the helix)
  private currentDisplayedExperience: TimelineExperience | null = null

  // Camera transition system
  private isCameraTransitioning = false
  private cameraTransitionStartTime = 0
  private cameraTransitionDuration = 2000 // 2 seconds
  private cameraStartPosition: THREE.Vector3 = new THREE.Vector3()
  private cameraStartTarget: THREE.Vector3 = new THREE.Vector3()
  private cameraEndPosition: THREE.Vector3 = new THREE.Vector3()
  private cameraEndTarget: THREE.Vector3 = new THREE.Vector3()
  private currentCamera: THREE.Camera | null = null
  private orbitControlsRef: any = null // Reference to OrbitControls

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

    // Store camera reference for transitions
    this.currentCamera = camera

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

    // Update camera transitions
    if (this.isCameraTransitioning) {
      this.updateCameraTransition(deltaTime)
    }

    // Update auto-navigation (only if not transitioning manually)
    if (this.isAutoNavigating && !this.isCameraTransitioning) {
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

    // Force all cards to face the same direction (debug)
    const helixCenter = new THREE.Vector3(0, experience.position3D.y, 0)
    const directionToCenter = helixCenter.clone().sub(experience.position3D).normalize()
    const angleToCenter = Math.atan2(directionToCenter.x, directionToCenter.z)

    // Set consistent rotation for all cards
    cardGroup.rotation.set(0, angleToCenter, 0)

    console.log(`Card ${experience.company}: position=${experience.position3D.x.toFixed(2)},${experience.position3D.z.toFixed(2)}, rotation=${angleToCenter.toFixed(2)}`)

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
   * Update smooth helix rail navigation
   */
  private updateAutoNavigation(deltaTime: number): void {
    // First check if auto-navigation is still enabled
    if (!this.isAutoNavigating) {
      return
    }

    if (!this.timelineData || this.timelineData.experiences.length === 0 || !this.helixCurve) {
      console.log('No timeline data available for auto-navigation')
      return
    }

    // Smooth continuous movement along helix
    this.helixNavigationProgress += deltaTime * this.smoothNavigationSpeed

    // Loop back to start when reaching the end
    if (this.helixNavigationProgress > 1) {
      this.helixNavigationProgress = 0
    }

    // Get current position along helix curve
    const helixPosition = this.helixCurve.getPoint(this.helixNavigationProgress)
    const helixTangent = this.helixCurve.getTangent(this.helixNavigationProgress)

    // Calculate camera position on the inner rail of the helix
    const cameraPosition = this.calculateHelixRailCameraPosition(helixPosition, helixTangent)
    const cameraTarget = this.calculateHelixRailCameraTarget(helixPosition, helixTangent)

    // Update camera
    this.cameraPosition = cameraPosition
    this.cameraTarget = cameraTarget

    // Check if we're near any experience and show tooltip
    this.checkNearbyExperiences()
  }

  /**
   * Calculate camera position on the inner rail of the helix
   */
  private calculateHelixRailCameraPosition(helixPosition: THREE.Vector3, helixTangent: THREE.Vector3): THREE.Vector3 {
    // Create a position inside the helix spiral
    const helixCenter = new THREE.Vector3(0, helixPosition.y, 0)
    const toCenter = helixCenter.clone().sub(helixPosition).normalize()

    // Position camera closer to center (inside the helix)
    const cameraPosition = helixPosition.clone().add(toCenter.multiplyScalar(this.cameraRadiusOffset))

    // Add height offset for better viewing angle
    cameraPosition.y += this.cameraHeightOffset

    return cameraPosition
  }

  /**
   * Calculate camera target for smooth helix navigation
   */
  private calculateHelixRailCameraTarget(helixPosition: THREE.Vector3, helixTangent: THREE.Vector3): THREE.Vector3 {
    // Look ahead along the helix curve
    const lookAheadDistance = 5
    const lookAheadTarget = helixPosition.clone().add(helixTangent.multiplyScalar(lookAheadDistance))

    return lookAheadTarget
  }

  /**
   * Check for nearby experiences and show tooltips
   */
  private checkNearbyExperiences(): void {
    if (!this.timelineData || !this.tooltipSystem) return

    const currentHelixPosition = this.helixCurve!.getPoint(this.helixNavigationProgress)
    const proximityThreshold = 4 // Distance threshold for showing tooltips

    // Find closest experience to current position
    let closestExperience: TimelineExperience | null = null
    let closestDistance = Infinity

    this.timelineData.experiences.forEach(experience => {
      const distance = currentHelixPosition.distanceTo(experience.position3D)
      if (distance < proximityThreshold && distance < closestDistance) {
        closestDistance = distance
        closestExperience = experience
      }
    })

    // Show tooltip for closest experience if within threshold
    if (closestExperience && closestExperience !== this.currentDisplayedExperience) {
      this.currentDisplayedExperience = closestExperience
      const experience = closestExperience as TimelineExperience
      this.tooltipSystem.showTooltip(experience, experience.position3D.clone())

      // Trigger callback
      if (this.onExperienceSelectCallback) {
        this.onExperienceSelectCallback(experience)
      }

      // Highlight the experience card
      this.highlightExperienceCard(experience.id)

      console.log(`Now viewing: ${experience.company}`)
    } else if (!closestExperience && this.currentDisplayedExperience) {
      // Hide tooltip when moving away from experiences
      this.tooltipSystem.hideTooltip()
      this.currentDisplayedExperience = null
      this.clearAllCardHighlights()
    }
  }

  /**
   * Clear all card highlights
   */
  private clearAllCardHighlights(): void {
    this.experienceCards.forEach(card => {
      card.userData.isSelected = false
      card.userData.isHovered = false
    })

    // Reset particle trails
    if (this.particleTrailManager) {
      this.particleTrailManager.setAllTrailsInteraction('idle')
    }
  }

  /**
   * Navigate to current experience and start pause
   */
  private navigateToCurrentExperience(): void {
    if (!this.timelineData || this.timelineData.experiences.length === 0) {
      console.log('Cannot navigate: no timeline data')
      return
    }

    if (this.currentExperienceIndex >= this.timelineData.experiences.length) {
      console.log('Invalid experience index, resetting to 0')
      this.currentExperienceIndex = 0
    }

    const experience = this.timelineData.experiences[this.currentExperienceIndex]
    if (!experience) {
      console.log('No experience found at index', this.currentExperienceIndex)
      return
    }

    console.log(`Navigating to experience: ${experience.company} (${this.currentExperienceIndex})`)

    // Navigate camera to current experience
    this.navigateToExperience(experience.id)

    // Trigger experience selection callback
    if (this.onExperienceSelectCallback) {
      this.onExperienceSelectCallback(experience)
    }

    // Show tooltip for current experience
    if (this.tooltipSystem) {
      this.tooltipSystem.showTooltip(experience, experience.position3D.clone())
    }

    // Highlight current experience card
    this.highlightExperienceCard(experience.id)
  }

  /**
   * Start pause at current experience
   */
  private pauseAtCurrentExperience(): void {
    if (this.isPausedAtExperience) return // Prevent multiple calls

    console.log(`Starting pause at experience ${this.currentExperienceIndex}`)
    this.isPausedAtExperience = true
    this.pauseStartTime = Date.now()
    this.navigateToCurrentExperience()
  }

  /**
   * Start transition to next experience
   */
  private startTransitionToNext(): void {
    this.isPausedAtExperience = false
    this.isTransitioningToNext = true
    this.transitionStartTime = Date.now()

    // Hide current tooltip
    if (this.tooltipSystem) {
      this.tooltipSystem.hideTooltip()
    }

    // Move to next experience
    this.currentExperienceIndex = (this.currentExperienceIndex + 1) % this.timelineData!.experiences.length
  }

  /**
   * Highlight specific experience card
   */
  private highlightExperienceCard(experienceId: string): void {
    // Reset all cards
    this.experienceCards.forEach(card => {
      card.userData.isSelected = false
      card.userData.isHovered = false
    })

    // Find and highlight current card
    const currentCard = this.experienceCards.find(
      card => card.userData.experience?.id === experienceId
    )

    if (currentCard) {
      currentCard.userData.isSelected = true

      // Update particle trail states
      if (this.particleTrailManager) {
        const trailIds = this.particleTrailManager.getTrailIds()
        trailIds.forEach(trailId => {
          if (trailId.includes(experienceId)) {
            this.particleTrailManager!.setTrailInteraction(trailId, 'selected')
          } else {
            this.particleTrailManager!.setTrailInteraction(trailId, 'idle')
          }
        })
      }
    }
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
   * Update camera transition animation
   */
  private updateCameraTransition(deltaTime: number): void {
    if (!this.isCameraTransitioning) return

    const currentTime = Date.now()
    const elapsed = currentTime - this.cameraTransitionStartTime
    const progress = Math.min(elapsed / this.cameraTransitionDuration, 1)

    // Use smooth easing function
    const easedProgress = this.easeInOutCubic(progress)

    // Interpolate camera position
    const newCameraPosition = new THREE.Vector3().lerpVectors(
      this.cameraStartPosition,
      this.cameraEndPosition,
      easedProgress
    )

    // Interpolate camera target
    const newCameraTarget = new THREE.Vector3().lerpVectors(
      this.cameraStartTarget,
      this.cameraEndTarget,
      easedProgress
    )

    // Apply to scene camera properties AND force update via camera controller
    this.cameraPosition = newCameraPosition
    this.cameraTarget = newCameraTarget

    // Also directly update the camera if we have access to it
    if (this.currentCamera) {
      this.currentCamera.position.copy(newCameraPosition)
      this.currentCamera.lookAt(newCameraTarget)
      this.currentCamera.updateMatrixWorld()
    }

    console.log(`Camera transition progress: ${(progress * 100).toFixed(1)}%, pos: (${newCameraPosition.x.toFixed(1)}, ${newCameraPosition.y.toFixed(1)}, ${newCameraPosition.z.toFixed(1)})`)

    // Complete transition
    if (progress >= 1) {
      this.isCameraTransitioning = false

      // Ensure the final camera position is preserved by updating scene properties
      this.cameraPosition = this.cameraEndPosition.clone()
      this.cameraTarget = this.cameraEndTarget.clone()

      // Also update the camera directly one final time
      if (this.currentCamera) {
        this.currentCamera.position.copy(this.cameraEndPosition)
        this.currentCamera.lookAt(this.cameraEndTarget)
        this.currentCamera.updateMatrixWorld()
      }

      // Re-enable OrbitControls after transition
      if (this.orbitControlsRef) {
        this.orbitControlsRef.enabled = true
        // Update OrbitControls target to match our final target
        this.orbitControlsRef.target.copy(this.cameraEndTarget)
        this.orbitControlsRef.update()
        console.log('OrbitControls re-enabled and updated')
      }

      console.log('Camera transition completed. Final position:', this.cameraPosition, 'Target:', this.cameraTarget)
    }
  }

  /**
   * Easing function for smooth animations
   */
  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1
  }

  /**
   * Start smooth camera transition
   */
  private startCameraTransition(targetPosition: THREE.Vector3, targetTarget: THREE.Vector3): void {
    // Disable OrbitControls during transition to prevent interference
    if (this.orbitControlsRef) {
      this.orbitControlsRef.enabled = false
      console.log('OrbitControls disabled for camera transition')
    }

    // Get current camera position from actual camera if available
    if (this.currentCamera) {
      this.cameraStartPosition.copy(this.currentCamera.position)

      // Calculate what the camera is currently looking at
      const direction = new THREE.Vector3()
      this.currentCamera.getWorldDirection(direction)
      const currentTarget = this.currentCamera.position.clone().add(direction.multiplyScalar(10))
      this.cameraStartTarget.copy(currentTarget)
    } else {
      // Fallback to scene properties
      this.cameraStartPosition.copy(this.cameraPosition || new THREE.Vector3(30, 25, 30))
      this.cameraStartTarget.copy(this.cameraTarget || new THREE.Vector3(0, 0, 0))
    }

    // Store target state
    this.cameraEndPosition.copy(targetPosition)
    this.cameraEndTarget.copy(targetTarget)

    // Start transition
    this.isCameraTransitioning = true
    this.cameraTransitionStartTime = Date.now()

    console.log('Starting camera transition from', this.cameraStartPosition, 'to', this.cameraEndPosition)
  }

  /**
   * Public methods for external control
   */
  public startAutoNavigation(): void {
    if (this.isAutoNavigating) {
      console.log('Auto-navigation already active, ignoring start request')
      return
    }

    this.isAutoNavigating = true

    // Initialize smooth helix navigation
    this.helixNavigationProgress = 0
    this.currentDisplayedExperience = null

    // Reset old card-based navigation states
    this.currentExperienceIndex = 0
    this.isPausedAtExperience = false
    this.isTransitioningToNext = false

    console.log('Smooth helix auto-navigation started')
  }

  public stopAutoNavigation(): void {
    console.log('Stopping smooth helix auto-navigation...')
    this.isAutoNavigating = false

    // Reset smooth navigation state
    this.helixNavigationProgress = 0
    this.currentDisplayedExperience = null

    // Reset old card-based navigation states
    this.isPausedAtExperience = false
    this.isTransitioningToNext = false

    // Reset all card states
    this.experienceCards.forEach(card => {
      card.userData.isSelected = false
      card.userData.isHovered = false
    })

    // Reset particle trails
    if (this.particleTrailManager) {
      this.particleTrailManager.setAllTrailsInteraction('idle')
    }

    // Hide tooltip when stopping auto-navigation
    if (this.tooltipSystem) {
      this.tooltipSystem.hideTooltip()
    }

    console.log('Smooth helix auto-navigation stopped')
  }

  public setExperienceSelectCallback(callback: (experience: TimelineExperience) => void): void {
    this.onExperienceSelectCallback = callback
  }

  public setNavigationSpeed(speed: number): void {
    this.autoNavigationSpeed = Math.max(0.01, Math.min(1, speed))
    // Update smooth helix navigation speed
    this.smoothNavigationSpeed = Math.max(0.01, Math.min(0.2, speed * 0.2)) // Scale for smooth movement
    console.log(`Helix navigation speed set to: ${this.smoothNavigationSpeed}`)
  }

  public setPauseDuration(duration: number): void {
    this.pauseDuration = Math.max(1000, duration)
  }

  public setTransitionDuration(duration: number): void {
    this.transitionDuration = Math.max(500, duration)
  }

  public getCurrentExperienceIndex(): number {
    return this.currentExperienceIndex
  }

  public getTotalExperiences(): number {
    return this.timelineData?.experiences.length || 0
  }

  public getIsAutoNavigating(): boolean {
    return this.isAutoNavigating
  }

  public getIsCameraTransitioning(): boolean {
    return this.isCameraTransitioning
  }

  public navigateToExperience(experienceId: string): void {
    if (!this.timelineData) {
      console.log('Cannot navigate: no timeline data')
      return
    }

    const experience = this.timelineData.experiences.find(exp => exp.id === experienceId)
    if (!experience) {
      console.log(`Experience not found: ${experienceId}`)
      return
    }

    console.log(`Starting smooth navigation to experience: ${experience.company}`)

    // Cards face inward toward helix center, so camera should be positioned inside looking out
    const cardPosition = experience.position3D.clone()

    // Calculate the direction the card is facing (toward helix center)
    const helixCenter = new THREE.Vector3(0, cardPosition.y, 0)
    const cardFaceDirection = helixCenter.clone().sub(cardPosition).normalize()

    // Position camera in front of the card (between card and helix center)
    const cameraDistance = 6
    const targetCameraPosition = cardPosition.clone().add(cardFaceDirection.multiplyScalar(cameraDistance))

    // Add slight upward offset for better viewing angle
    targetCameraPosition.y += 2

    // Make sure we have valid positions
    if (!targetCameraPosition || !experience.position3D) {
      console.log('Invalid camera position data')
      return
    }

    // Start smooth camera transition instead of instant positioning
    this.startCameraTransition(targetCameraPosition, cardPosition)

    // Highlight the experience card
    this.highlightExperienceCard(experience.id)

    console.log('Camera position set:', targetCameraPosition)
    console.log('Camera target set:', cardPosition)
    console.log('Card rotation:', experience.cardRotation)
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
