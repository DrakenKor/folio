import * as THREE from 'three'
import { SectionType, QualityLevel, TransitionOptions } from '@/types'

// Core scene management types
export interface SceneManager {
  currentScene: SceneType | null
  isTransitioning: boolean
  transitionTo(scene: SceneType, options?: TransitionOptions): Promise<void>
  registerScene(scene: Scene3D): void
  unregisterScene(sceneId: string): void
  getScene(sceneId: string): Scene3D | undefined
  dispose(): void
  update(deltaTime: number): void
  resize(width: number, height: number): void
}

export interface Scene3D {
  id: string
  name: string
  isInitialized: boolean
  isActive: boolean
  qualityLevel: QualityLevel
  cameraPosition?: THREE.Vector3 | null
  cameraTarget?: THREE.Vector3 | null

  initialize(renderer: THREE.WebGLRenderer, camera: THREE.Camera): Promise<void>
  activate(): Promise<void>
  deactivate(): Promise<void>
  update(deltaTime: number): void
  render(renderer: THREE.WebGLRenderer, camera: THREE.Camera): void
  resize(width: number, height: number): void
  cleanup(): void
  setQualityLevel(level: QualityLevel): void
}

export interface CameraController {
  camera: THREE.Camera
  target: THREE.Vector3
  isTransitioning: boolean

  setPosition(position: THREE.Vector3, target?: THREE.Vector3): void
  transitionTo(position: THREE.Vector3, target: THREE.Vector3, options?: CameraTransitionOptions): Promise<void>
  update(deltaTime: number): void
  resize(aspect: number): void
  dispose(): void
}

export interface CameraTransitionOptions {
  duration: number
  easing: EasingFunction
  lookAt?: THREE.Vector3
  onUpdate?: (progress: number) => void
  onComplete?: () => void
}

export type EasingFunction = (t: number) => number
export type SceneType = SectionType

// Scene lifecycle events
export interface SceneLifecycleEvents {
  onBeforeActivate?: () => Promise<void>
  onAfterActivate?: () => void
  onBeforeDeactivate?: () => Promise<void>
  onAfterDeactivate?: () => void
  onQualityChange?: (level: QualityLevel) => void
}

// Scene configuration
export interface SceneConfig {
  id: string
  name: string
  preloadAssets?: string[]
  supportedQualityLevels: QualityLevel[]
  defaultQualityLevel: QualityLevel
  cameraConfig?: CameraConfig
}

export interface CameraConfig {
  type: 'perspective' | 'orthographic'
  position: THREE.Vector3
  target: THREE.Vector3
  fov?: number
  near?: number
  far?: number
}
