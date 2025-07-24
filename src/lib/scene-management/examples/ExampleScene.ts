import * as THREE from 'three'
import { BaseScene3D } from '../BaseScene3D'
import { SceneConfig, SceneLifecycleEvents } from '../types'
import { QualityLevel } from '@/types'

/**
 * Example scene implementation to demonstrate the scene management system
 */
export class ExampleScene extends BaseScene3D {
  private cube: THREE.Mesh | null = null
  private light: THREE.DirectionalLight | null = null
  private animationSpeed: number = 1

  /**
   * Create a new ExampleScene
   */
  constructor() {
    // Define scene configuration
    const config: SceneConfig = {
      id: 'example-scene',
      name: 'Example Scene',
      supportedQualityLevels: [
        QualityLevel.LOW,
        QualityLevel.MEDIUM,
        QualityLevel.HIGH,
        QualityLevel.ULTRA
      ],
      defaultQualityLevel: QualityLevel.HIGH,
      cameraConfig: {
        type: 'perspective',
        position: new THREE.Vector3(0, 0, 5),
        target: new THREE.Vector3(0, 0, 0),
        fov: 75,
        near: 0.1,
        far: 1000
      }
    }

    // Define lifecycle events
    const lifecycleEvents: SceneLifecycleEvents = {
      onBeforeActivate: async () => {
        console.log('Example scene is about to activate')
      },
      onAfterActivate: () => {
        console.log('Example scene has activated')
      },
      onBeforeDeactivate: async () => {
        console.log('Example scene is about to deactivate')
      },
      onAfterDeactivate: () => {
        console.log('Example scene has deactivated')
      },
      onQualityChange: (level) => {
        console.log(`Example scene quality changed to ${level}`)
      }
    }

    super(config, lifecycleEvents)
  }

  /**
   * Initialize the scene
   */
  protected async onInitialize(renderer: THREE.WebGLRenderer, camera: THREE.Camera): Promise<void> {
    // Set up scene background
    this.scene.background = new THREE.Color(0x1a1a2e)

    // Create a cube
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = new THREE.MeshStandardMaterial({
      color: 0x6a8caf,
      roughness: 0.7,
      metalness: 0.3
    })
    this.cube = new THREE.Mesh(geometry, material)
    this.scene.add(this.cube)

    // Add lighting
    this.light = new THREE.DirectionalLight(0xffffff, 1)
    this.light.position.set(1, 1, 1)
    this.scene.add(this.light)

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5)
    this.scene.add(ambientLight)

    // Apply quality settings
    this.applyQualitySettings(this.qualityLevel)
  }

  /**
   * Activate the scene
   */
  protected async onActivate(): Promise<void> {
    // Reset cube rotation
    if (this.cube) {
      this.cube.rotation.set(0, 0, 0)
    }
  }

  /**
   * Deactivate the scene
   */
  protected async onDeactivate(): Promise<void> {
    // Nothing special to do here
  }

  /**
   * Update the scene
   */
  protected onUpdate(deltaTime: number): void {
    // Rotate the cube
    if (this.cube) {
      this.cube.rotation.x += 0.5 * deltaTime * this.animationSpeed
      this.cube.rotation.y += 0.7 * deltaTime * this.animationSpeed
    }
  }

  /**
   * Called before rendering
   */
  protected onBeforeRender(renderer: THREE.WebGLRenderer, camera: THREE.Camera): void {
    // Nothing special to do here
  }

  /**
   * Called after rendering
   */
  protected onAfterRender(renderer: THREE.WebGLRenderer, camera: THREE.Camera): void {
    // Nothing special to do here
  }

  /**
   * Handle resize events
   */
  protected onResize(width: number, height: number): void {
    // Nothing special to do here
  }

  /**
   * Clean up resources
   */
  protected onCleanup(): void {
    // Nothing special to do here
  }

  /**
   * Handle quality changes
   */
  protected onQualityChange(level: QualityLevel): void {
    this.applyQualitySettings(level)
  }

  /**
   * Apply quality settings based on quality level
   */
  private applyQualitySettings(level: QualityLevel): void {
    switch (level) {
      case QualityLevel.LOW:
        this.animationSpeed = 0.5
        if (this.light) {
          this.light.castShadow = false
        }
        break
      case QualityLevel.MEDIUM:
        this.animationSpeed = 0.75
        if (this.light) {
          this.light.castShadow = false
        }
        break
      case QualityLevel.HIGH:
        this.animationSpeed = 1
        if (this.light) {
          this.light.castShadow = true
        }
        break
      case QualityLevel.ULTRA:
        this.animationSpeed = 1.25
        if (this.light) {
          this.light.castShadow = true
        }
        break
    }
  }
}
