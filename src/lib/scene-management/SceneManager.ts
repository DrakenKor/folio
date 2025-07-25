import * as THREE from 'three'
import { Scene3D, SceneType, CameraController } from './types'
import { TransitionOptions } from '../../types'
import { QualityLevel } from '../../types'
import { PerformanceMonitor } from '../performance-monitor'
import { CameraControllerImpl } from './CameraController'

/**
 * SceneManager is responsible for managing 3D scenes and transitions between them.
 * It handles scene registration, activation, deactivation, and rendering.
 */
export class SceneManager {
  private static instance: SceneManager
  private scenes: Map<string, Scene3D> = new Map()
  private _currentScene: Scene3D | null = null
  private _isTransitioning: boolean = false
  private renderer: THREE.WebGLRenderer | null = null
  private cameraController: CameraController | null = null
  private clock: THREE.Clock = new THREE.Clock()
  private performanceMonitor: PerformanceMonitor
  private animationFrameId: number | null = null
  private defaultQualityLevel: QualityLevel = QualityLevel.HIGH

  /**
   * Get the singleton instance of SceneManager
   */
  public static getInstance(): SceneManager {
    if (!SceneManager.instance) {
      SceneManager.instance = new SceneManager()
    }
    return SceneManager.instance
  }

  private constructor() {
    this.performanceMonitor = PerformanceMonitor.getInstance()
  }

  /**
   * Initialize the SceneManager with a WebGL renderer
   */
  public initialize(
    renderer: THREE.WebGLRenderer,
    camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
    defaultQuality: QualityLevel = QualityLevel.HIGH
  ): void {
    this.renderer = renderer
    this.cameraController = new CameraControllerImpl(camera)
    this.defaultQualityLevel = defaultQuality
    this.startRenderLoop()
  }

  /**
   * Register a scene with the SceneManager
   */
  public registerScene(scene: Scene3D): void {
    if (this.scenes.has(scene.id)) {
      console.warn(`Scene with id ${scene.id} is already registered`)
      return
    }

    this.scenes.set(scene.id, scene)
    console.log(`Scene registered: ${scene.id}`)
  }

  /**
   * Unregister a scene from the SceneManager
   */
  public unregisterScene(sceneId: string): void {
    if (!this.scenes.has(sceneId)) {
      console.warn(`Scene with id ${sceneId} not found`)
      return
    }

    const scene = this.scenes.get(sceneId)
    if (scene === this._currentScene) {
      this._currentScene = null
    }

    this.scenes.delete(sceneId)

  }

  /**
   * Get a scene by its ID
   */
  public getScene(sceneId: string): Scene3D | undefined {
    return this.scenes.get(sceneId)
  }

  /**
   * Get the current active scene
   */
  public get currentScene(): SceneType | null {
    return this._currentScene ? this._currentScene.id as SceneType : null
  }

  /**
   * Check if a transition is in progress
   */
  public get isTransitioning(): boolean {
    return this._isTransitioning
  }

  /**
   * Transition to a new scene
   */
  public async transitionTo(sceneType: SceneType, options: TransitionOptions = { duration: 1000, easing: 'easeInOutCubic' }): Promise<void> {
    if (!this.renderer || !this.cameraController) {
      console.error('SceneManager not initialized')
      return
    }

    const targetScene = this.getSceneByType(sceneType)
    if (!targetScene) {
      console.error(`Scene ${sceneType} not found`)
      return
    }

    if (this._isTransitioning) {
      console.warn('Transition already in progress')
      return
    }

    this._isTransitioning = true

    try {
      // Initialize target scene if needed
      if (!targetScene.isInitialized) {
        await targetScene.initialize(this.renderer, this.cameraController.camera)
      }

      // Deactivate current scene if exists
      if (this._currentScene) {
        await this._currentScene.deactivate()
      }

      // Activate new scene
      await targetScene.activate()

      // Set as current scene
      this._currentScene = targetScene

      // Perform camera transition if needed
      if (targetScene.cameraPosition && targetScene.cameraTarget) {
        await this.cameraController.transitionTo(
          targetScene.cameraPosition,
          targetScene.cameraTarget,
          {
            duration: options.duration,
            easing: this.getEasingFunction(options.easing),
            onUpdate: (progress) => {
              // Could emit progress events here
            }
          }
        )
      }
    } catch (error) {
      console.error('Scene transition failed:', error)
      throw error // Re-throw for SceneTransitionManager to handle
    } finally {
      this._isTransitioning = false
    }
  }

  /**
   * Update all active scenes
   */
  public update(): void {
    if (!this.renderer || !this.cameraController) return

    const deltaTime = this.clock.getDelta()

    // Update camera controller
    this.cameraController.update(deltaTime)

    // Update current scene
    if (this._currentScene) {
      this._currentScene.update(deltaTime)

      // Apply scene camera position and target only if auto-navigation is active and no manual transitions
      const scene = this._currentScene as any
      const isAutoNavigating = scene.getIsAutoNavigating && scene.getIsAutoNavigating()
      const isCameraTransitioning = scene.getIsCameraTransitioning && scene.getIsCameraTransitioning()

      if (isAutoNavigating && !isCameraTransitioning &&
          this._currentScene.cameraPosition && this._currentScene.cameraTarget &&
          !this.cameraController.isTransitioning) {
        this.cameraController.setPosition(this._currentScene.cameraPosition, this._currentScene.cameraTarget)
      }
    }

    // Render the current scene
    this.render()

    // Update performance metrics
    if (this.renderer.info) {
      this.performanceMonitor.updateRenderStats({
        drawCalls: this.renderer.info.render.calls,
        triangles: this.renderer.info.render.triangles,
      })
    }
  }

  /**
   * Render the current scene
   */
  private render(): void {
    if (!this.renderer || !this.cameraController || !this._currentScene) return

    this._currentScene.render(this.renderer, this.cameraController.camera)
  }

  /**
   * Start the render loop
   */
  private startRenderLoop(): void {
    if (this.animationFrameId !== null) return

    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate)
      this.update()
    }

    animate()
  }

  /**
   * Stop the render loop
   */
  private stopRenderLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  /**
   * Resize all scenes
   */
  public resize(width: number, height: number): void {
    if (!this.renderer || !this.cameraController) return

    // Update renderer size
    this.renderer.setSize(width, height)

    // Update camera aspect ratio
    if (this.cameraController.camera instanceof THREE.PerspectiveCamera) {
      this.cameraController.camera.aspect = width / height
      this.cameraController.camera.updateProjectionMatrix()
    }

    // Update camera controller
    this.cameraController.resize(width / height)

    // Update all scenes
    this.scenes.forEach(scene => {
      scene.resize(width, height)
    })
  }

  /**
   * Set quality level for all scenes
   */
  public setQualityLevel(level: QualityLevel): void {
    this.scenes.forEach(scene => {
      scene.setQualityLevel(level)
    })
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.stopRenderLoop()

    // Dispose all scenes
    this.scenes.forEach(scene => {
      scene.cleanup()
    })

    this.scenes.clear()
    this._currentScene = null

    // Dispose camera controller
    if (this.cameraController) {
      this.cameraController.dispose()
      this.cameraController = null
    }
  }

  /**
   * Get a scene by its type
   */
  private getSceneByType(sceneType: SceneType): Scene3D | undefined {
    for (const scene of this.scenes.values()) {
      if (scene.id === sceneType) {
        return scene
      }
    }
    return undefined
  }

  /**
   * Get an easing function by name
   */
  private getEasingFunction(name: string): (t: number) => number {
    const easingFunctions = {
      linear: (t: number) => t,
      easeInQuad: (t: number) => t * t,
      easeOutQuad: (t: number) => t * (2 - t),
      easeInOutQuad: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
      easeInCubic: (t: number) => t * t * t,
      easeOutCubic: (t: number) => (--t) * t * t + 1,
      easeInOutCubic: (t: number) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
    }

    return easingFunctions[name as keyof typeof easingFunctions] || easingFunctions.linear
  }
}
