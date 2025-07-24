import * as THREE from 'three'
import { Scene3D, SceneConfig, SceneLifecycleEvents } from './types'
import { QualityLevel } from '@/types'

/**
 * Abstract base class for all 3D scenes
 * Provides common functionality and lifecycle management
 */
export abstract class BaseScene3D implements Scene3D {
  public id: string
  public name: string
  public isInitialized: boolean = false
  public isActive: boolean = false
  public qualityLevel: QualityLevel

  protected scene: THREE.Scene
  protected config: SceneConfig
  protected lifecycleEvents: SceneLifecycleEvents
  protected assets: Map<string, any> = new Map()

  // Camera positioning
  public cameraPosition: THREE.Vector3 | null = null
  public cameraTarget: THREE.Vector3 | null = null

  /**
   * Create a new BaseScene3D instance
   * @param config Scene configuration
   * @param lifecycleEvents Optional lifecycle event handlers
   */
  constructor(config: SceneConfig, lifecycleEvents: SceneLifecycleEvents = {}) {
    this.id = config.id
    this.name = config.name
    this.config = config
    this.qualityLevel = config.defaultQualityLevel
    this.lifecycleEvents = lifecycleEvents
    this.scene = new THREE.Scene()

    // Set default camera position and target if provided in config
    if (config.cameraConfig) {
      this.cameraPosition = config.cameraConfig.position
      this.cameraTarget = config.cameraConfig.target
    }
  }

  /**
   * Initialize the scene
   * This is called once before the scene is first activated
   */
  public async initialize(renderer: THREE.WebGLRenderer, camera: THREE.Camera): Promise<void> {
    if (this.isInitialized) return

    try {
      // Load assets if needed
      if (this.config.preloadAssets && this.config.preloadAssets.length > 0) {
        await this.preloadAssets(this.config.preloadAssets)
      }

      // Call implementation-specific initialization
      await this.onInitialize(renderer, camera)

      this.isInitialized = true
    } catch (error) {
      console.error(`Failed to initialize scene ${this.id}:`, error)
      throw error
    }
  }

  /**
   * Activate the scene
   * This is called each time the scene becomes active
   */
  public async activate(): Promise<void> {
    if (this.isActive) return

    try {
      // Call before activate lifecycle event
      if (this.lifecycleEvents.onBeforeActivate) {
        await this.lifecycleEvents.onBeforeActivate()
      }

      // Call implementation-specific activation
      await this.onActivate()

      this.isActive = true

      // Call after activate lifecycle event
      if (this.lifecycleEvents.onAfterActivate) {
        this.lifecycleEvents.onAfterActivate()
      }
    } catch (error) {
      console.error(`Failed to activate scene ${this.id}:`, error)
      throw error
    }
  }

  /**
   * Deactivate the scene
   * This is called when the scene is no longer active
   */
  public async deactivate(): Promise<void> {
    if (!this.isActive) return

    try {
      // Call before deactivate lifecycle event
      if (this.lifecycleEvents.onBeforeDeactivate) {
        await this.lifecycleEvents.onBeforeDeactivate()
      }

      // Call implementation-specific deactivation
      await this.onDeactivate()

      this.isActive = false

      // Call after deactivate lifecycle event
      if (this.lifecycleEvents.onAfterDeactivate) {
        this.lifecycleEvents.onAfterDeactivate()
      }
    } catch (error) {
      console.error(`Failed to deactivate scene ${this.id}:`, error)
      throw error
    }
  }

  /**
   * Update the scene
   * This is called every frame when the scene is active
   */
  public update(deltaTime: number): void {
    if (!this.isActive) return

    // Call implementation-specific update
    this.onUpdate(deltaTime)
  }

  /**
   * Render the scene
   * This is called every frame when the scene is active
   */
  public render(renderer: THREE.WebGLRenderer, camera: THREE.Camera): void {
    if (!this.isActive) return

    // Call implementation-specific pre-render
    this.onBeforeRender(renderer, camera)

    // Render the scene
    renderer.render(this.scene, camera)

    // Call implementation-specific post-render
    this.onAfterRender(renderer, camera)
  }

  /**
   * Resize the scene
   * This is called when the window is resized
   */
  public resize(width: number, height: number): void {
    // Call implementation-specific resize
    this.onResize(width, height)
  }

  /**
   * Clean up the scene
   * This is called when the scene is being disposed
   */
  public cleanup(): void {
    // Call implementation-specific cleanup
    this.onCleanup()

    // Dispose of all assets
    this.disposeAssets()

    // Dispose of all objects in the scene
    this.disposeScene()

    this.isInitialized = false
    this.isActive = false
  }

  /**
   * Set the quality level for the scene
   */
  public setQualityLevel(level: QualityLevel): void {
    if (this.qualityLevel === level) return

    // Check if the quality level is supported
    if (!this.config.supportedQualityLevels.includes(level)) {
      console.warn(`Quality level ${level} is not supported by scene ${this.id}. Using ${this.qualityLevel} instead.`)
      return
    }

    this.qualityLevel = level

    // Call implementation-specific quality change
    this.onQualityChange(level)

    // Call quality change lifecycle event
    if (this.lifecycleEvents.onQualityChange) {
      this.lifecycleEvents.onQualityChange(level)
    }
  }

  /**
   * Preload assets for the scene
   */
  protected async preloadAssets(assetPaths: string[]): Promise<void> {
    // Implementation would depend on asset types
    // This is a placeholder for actual asset loading logic
    console.log(`Preloading ${assetPaths.length} assets for scene ${this.id}`)
  }

  /**
   * Dispose of all assets
   */
  protected disposeAssets(): void {
    this.assets.forEach((asset, key) => {
      // Dispose of asset if it has a dispose method
      if (asset && typeof asset.dispose === 'function') {
        asset.dispose()
      }

      this.assets.delete(key)
    })
  }

  /**
   * Dispose of all objects in the scene
   */
  protected disposeScene(): void {
    // Recursively dispose of all objects in the scene
    this.scene.traverse((object) => {
      // Dispose of geometries
      if ((object as THREE.Mesh).geometry) {
        (object as THREE.Mesh).geometry.dispose()
      }

      // Dispose of materials
      if ((object as THREE.Mesh).material) {
        const materials = Array.isArray((object as THREE.Mesh).material)
          ? (object as THREE.Mesh).material
          : [(object as THREE.Mesh).material]

        materials.forEach((material) => {
          material.dispose()

          // Dispose of textures
          for (const key in material) {
            const value = material[key]
            if (value && typeof value === 'object' && 'isTexture' in value) {
              value.dispose()
            }
          }
        })
      }
    })

    // Clear the scene
    while (this.scene.children.length > 0) {
      this.scene.remove(this.scene.children[0])
    }
  }

  // Abstract methods to be implemented by subclasses
  protected abstract onInitialize(renderer: THREE.WebGLRenderer, camera: THREE.Camera): Promise<void>
  protected abstract onActivate(): Promise<void>
  protected abstract onDeactivate(): Promise<void>
  protected abstract onUpdate(deltaTime: number): void
  protected abstract onBeforeRender(renderer: THREE.WebGLRenderer, camera: THREE.Camera): void
  protected abstract onAfterRender(renderer: THREE.WebGLRenderer, camera: THREE.Camera): void
  protected abstract onResize(width: number, height: number): void
  protected abstract onCleanup(): void
  protected abstract onQualityChange(level: QualityLevel): void
}
