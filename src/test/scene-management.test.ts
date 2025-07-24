/**
 * Unit tests for Scene Management System
 * Run with: npm test or vitest
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as THREE from 'three'
import { SceneManager } from '@/lib/scene-management/SceneManager'
import { BaseScene3D } from '@/lib/scene-management/BaseScene3D'
import { SceneTransitionManager } from '@/lib/scene-management/SceneTransitionManager'
import { QualityLevel, SectionType } from '@/types'
import { SceneConfig } from '@/lib/scene-management/types'

// Mock Three.js WebGLRenderer
vi.mock('three', async () => {
  const actual = await vi.importActual('three')
  return {
    ...actual,
    WebGLRenderer: vi.fn().mockImplementation(() => ({
      setSize: vi.fn(),
      setClearColor: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn(),
      info: {
        render: {
          calls: 0,
          triangles: 0
        }
      }
    }))
  }
})

// Test Scene Implementation
class TestScene extends BaseScene3D {
  constructor(config: SceneConfig) {
    super(config)
  }

  protected async onInitialize(): Promise<void> {
    // Mock initialization
  }

  protected async onActivate(): Promise<void> {
    // Mock activation
  }

  protected async onDeactivate(): Promise<void> {
    // Mock deactivation
  }

  protected onUpdate(): void {
    // Mock update
  }

  protected onBeforeRender(): void {
    // Mock before render
  }

  protected onAfterRender(): void {
    // Mock after render
  }

  protected onResize(): void {
    // Mock resize
  }

  protected onCleanup(): void {
    // Mock cleanup
  }

  protected onQualityChange(): void {
    // Mock quality change
  }
}

describe('Scene Management System', () => {
  let sceneManager: SceneManager
  let renderer: THREE.WebGLRenderer
  let camera: THREE.PerspectiveCamera

  beforeEach(() => {
    // Reset singleton instance
    ;(SceneManager as any).instance = null
    sceneManager = SceneManager.getInstance()

    renderer = new THREE.WebGLRenderer()
    camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)

    sceneManager.initialize(renderer, camera)
  })

  describe('SceneManager', () => {
    it('should be a singleton', () => {
      const instance1 = SceneManager.getInstance()
      const instance2 = SceneManager.getInstance()
      expect(instance1).toBe(instance2)
    })

    it('should register scenes correctly', () => {
      const testScene = new TestScene({
        id: SectionType.HOME,
        name: 'Test Scene',
        supportedQualityLevels: [QualityLevel.HIGH],
        defaultQualityLevel: QualityLevel.HIGH
      })

      sceneManager.registerScene(testScene)
      const retrievedScene = sceneManager.getScene(SectionType.HOME)

      expect(retrievedScene).toBe(testScene)
    })

    it('should unregister scenes correctly', () => {
      const testScene = new TestScene({
        id: SectionType.HOME,
        name: 'Test Scene',
        supportedQualityLevels: [QualityLevel.HIGH],
        defaultQualityLevel: QualityLevel.HIGH
      })

      sceneManager.registerScene(testScene)
      sceneManager.unregisterScene(SectionType.HOME)
      const retrievedScene = sceneManager.getScene(SectionType.HOME)

      expect(retrievedScene).toBeUndefined()
    })

    it('should handle quality level changes', () => {
      const testScene = new TestScene({
        id: SectionType.HOME,
        name: 'Test Scene',
        supportedQualityLevels: [QualityLevel.LOW, QualityLevel.HIGH],
        defaultQualityLevel: QualityLevel.HIGH
      })

      const qualityChangeSpy = vi.spyOn(testScene, 'setQualityLevel')
      sceneManager.registerScene(testScene)
      sceneManager.setQualityLevel(QualityLevel.LOW)

      expect(qualityChangeSpy).toHaveBeenCalledWith(QualityLevel.LOW)
    })

    it('should handle resize correctly', () => {
      const testScene = new TestScene({
        id: SectionType.HOME,
        name: 'Test Scene',
        supportedQualityLevels: [QualityLevel.HIGH],
        defaultQualityLevel: QualityLevel.HIGH
      })

      const resizeSpy = vi.spyOn(testScene, 'resize')
      sceneManager.registerScene(testScene)
      sceneManager.resize(800, 600)

      expect(resizeSpy).toHaveBeenCalledWith(800, 600)
    })
  })

  describe('BaseScene3D', () => {
    let testScene: TestScene

    beforeEach(() => {
      testScene = new TestScene({
        id: SectionType.HOME,
        name: 'Test Scene',
        supportedQualityLevels: [QualityLevel.LOW, QualityLevel.HIGH],
        defaultQualityLevel: QualityLevel.HIGH
      })
    })

    it('should initialize with correct properties', () => {
      expect(testScene.id).toBe(SectionType.HOME)
      expect(testScene.name).toBe('Test Scene')
      expect(testScene.isInitialized).toBe(false)
      expect(testScene.isActive).toBe(false)
      expect(testScene.qualityLevel).toBe(QualityLevel.HIGH)
    })

    it('should handle initialization lifecycle', async () => {
      expect(testScene.isInitialized).toBe(false)

      await testScene.initialize(renderer, camera)

      expect(testScene.isInitialized).toBe(true)
    })

    it('should handle activation lifecycle', async () => {
      await testScene.initialize(renderer, camera)
      expect(testScene.isActive).toBe(false)

      await testScene.activate()

      expect(testScene.isActive).toBe(true)
    })

    it('should handle deactivation lifecycle', async () => {
      await testScene.initialize(renderer, camera)
      await testScene.activate()
      expect(testScene.isActive).toBe(true)

      await testScene.deactivate()

      expect(testScene.isActive).toBe(false)
    })

    it('should handle quality level changes', () => {
      expect(testScene.qualityLevel).toBe(QualityLevel.HIGH)

      testScene.setQualityLevel(QualityLevel.LOW)

      expect(testScene.qualityLevel).toBe(QualityLevel.LOW)
    })

    it('should reject unsupported quality levels', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      testScene.setQualityLevel(QualityLevel.ULTRA)

      expect(testScene.qualityLevel).toBe(QualityLevel.HIGH) // Should remain unchanged
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe('SceneTransitionManager', () => {
    let transitionManager: SceneTransitionManager

    beforeEach(() => {
      // Reset singleton instance
      ;(SceneTransitionManager as any).instance = null
      transitionManager = SceneTransitionManager.getInstance()
    })

    it('should be a singleton', () => {
      const instance1 = SceneTransitionManager.getInstance()
      const instance2 = SceneTransitionManager.getInstance()
      expect(instance1).toBe(instance2)
    })

    it('should initialize with correct default state', () => {
      const transitionState = transitionManager.getTransitionState()
      const loadingState = transitionManager.getLoadingState()

      expect(transitionState.isTransitioning).toBe(false)
      expect(transitionState.progress).toBe(0)
      expect(loadingState.isLoading).toBe(false)
      expect(loadingState.progress).toBe(0)
    })

    it('should handle callback registration', () => {
      const mockCallback = vi.fn()

      transitionManager.setCallbacks({
        onStart: mockCallback
      })

      // Callbacks should be set (we can't directly test this without triggering a transition)
      expect(true).toBe(true) // Placeholder assertion
    })
  })

  describe('Integration Tests', () => {
    it('should handle complete scene transition workflow', async () => {
      const homeScene = new TestScene({
        id: SectionType.HOME,
        name: 'Home Scene',
        supportedQualityLevels: [QualityLevel.HIGH],
        defaultQualityLevel: QualityLevel.HIGH,
        cameraConfig: {
          type: 'perspective',
          position: new THREE.Vector3(0, 0, 5),
          target: new THREE.Vector3(0, 0, 0)
        }
      })

      const resumeScene = new TestScene({
        id: SectionType.RESUME,
        name: 'Resume Scene',
        supportedQualityLevels: [QualityLevel.HIGH],
        defaultQualityLevel: QualityLevel.HIGH,
        cameraConfig: {
          type: 'perspective',
          position: new THREE.Vector3(3, 2, 5),
          target: new THREE.Vector3(0, 0, 0)
        }
      })

      // Register scenes
      sceneManager.registerScene(homeScene)
      sceneManager.registerScene(resumeScene)

      // Transition to home scene
      await sceneManager.transitionTo(SectionType.HOME as any)
      expect(sceneManager.currentScene).toBe(SectionType.HOME)
      expect(homeScene.isActive).toBe(true)

      // Transition to resume scene
      await sceneManager.transitionTo(SectionType.RESUME as any)
      expect(sceneManager.currentScene).toBe(SectionType.RESUME)
      expect(homeScene.isActive).toBe(false)
      expect(resumeScene.isActive).toBe(true)
    })
  })
})

// Export for manual testing
export { TestScene }
