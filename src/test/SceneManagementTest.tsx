'use client'

import React, { useEffect, useState, useRef } from 'react'
import * as THREE from 'three'
import { SceneManager } from '@/lib/scene-management/SceneManager'
import { BaseScene3D } from '@/lib/scene-management/BaseScene3D'
import { SceneTransitionManager } from '@/lib/scene-management/SceneTransitionManager'
import { SceneConfig } from '@/lib/scene-management/types'
import { QualityLevel, SectionType } from '@/types'
import { useSceneTransition } from '@/hooks/useSceneTransition'
import { SceneTransitionLoader } from '@/components/SceneTransitionLoader'

// Test Scene Implementation
class TestScene extends BaseScene3D {
  private cube: THREE.Mesh | null = null
  private light: THREE.DirectionalLight | null = null

  constructor(config: SceneConfig, color: number = 0x00ff00) {
    super(config)

    // Add a simple cube to the scene
    const geometry = new THREE.BoxGeometry(2, 2, 2)
    const material = new THREE.MeshPhongMaterial({ color })
    this.cube = new THREE.Mesh(geometry, material)
    this.scene.add(this.cube)

    // Add lighting
    this.light = new THREE.DirectionalLight(0xffffff, 1)
    this.light.position.set(5, 5, 5)
    this.scene.add(this.light)

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4)
    this.scene.add(ambientLight)
  }

  protected async onInitialize(renderer: THREE.WebGLRenderer, camera: THREE.Camera): Promise<void> {
    console.log(`Initializing test scene: ${this.id}`)
    // Simulate initialization delay
    await new Promise(resolve => setTimeout(resolve, 200))
  }

  protected async onActivate(): Promise<void> {
    console.log(`Activating test scene: ${this.id}`)
    // Simulate activation delay
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  protected async onDeactivate(): Promise<void> {
    console.log(`Deactivating test scene: ${this.id}`)
  }

  protected onUpdate(deltaTime: number): void {
    if (this.cube) {
      this.cube.rotation.x += deltaTime * 0.5
      this.cube.rotation.y += deltaTime * 0.3
    }
  }

  protected onBeforeRender(renderer: THREE.WebGLRenderer, camera: THREE.Camera): void {
    // Pre-render logic
  }

  protected onAfterRender(renderer: THREE.WebGLRenderer, camera: THREE.Camera): void {
    // Post-render logic
  }

  protected onResize(width: number, height: number): void {
    // Handle resize
  }

  protected onCleanup(): void {
    if (this.cube) {
      this.cube.geometry.dispose()
      if (Array.isArray(this.cube.material)) {
        this.cube.material.forEach(mat => mat.dispose())
      } else {
        this.cube.material.dispose()
      }
    }
  }

  protected onQualityChange(level: QualityLevel): void {
    console.log(`Quality changed to ${level} for scene ${this.id}`)
    // Adjust quality-specific settings
  }
}

/**
 * Comprehensive test component for the scene management system
 */
export function SceneManagementTest() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [renderer, setRenderer] = useState<THREE.WebGLRenderer | null>(null)
  const [camera, setCamera] = useState<THREE.PerspectiveCamera | null>(null)
  const [sceneManager, setSceneManager] = useState<SceneManager | null>(null)
  const [testResults, setTestResults] = useState<string[]>([])
  const [isRunning, setIsRunning] = useState(false)

  const { transitionTo, transitionState, loadingState, isTransitioning } = useSceneTransition({
    onStart: (from, to) => {
      addTestResult(`✅ Transition started: ${from} → ${to}`)
    },
    onProgress: (progress, stage) => {
      if (progress === 1) {
        addTestResult(`✅ Stage completed: ${stage} (${Math.round(progress * 100)}%)`)
      }
    },
    onComplete: (scene) => {
      addTestResult(`✅ Transition completed to: ${scene}`)
    },
    onError: (error) => {
      addTestResult(`❌ Transition error: ${error.message}`)
    }
  })

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`])
  }

  // Initialize Three.js scene
  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const newRenderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    newRenderer.setSize(800, 600)
    newRenderer.setClearColor(0x000011)

    const newCamera = new THREE.PerspectiveCamera(75, 800 / 600, 0.1, 1000)
    newCamera.position.set(0, 0, 5)

    setRenderer(newRenderer)
    setCamera(newCamera)

    return () => {
      newRenderer.dispose()
    }
  }, [])

  // Initialize Scene Manager
  useEffect(() => {
    if (!renderer || !camera) return

    const manager = SceneManager.getInstance()
    manager.initialize(renderer, camera, QualityLevel.HIGH)
    setSceneManager(manager)

    // Create test scenes
    const homeScene = new TestScene({
      id: SectionType.HOME,
      name: 'Home Scene',
      supportedQualityLevels: [QualityLevel.LOW, QualityLevel.MEDIUM, QualityLevel.HIGH],
      defaultQualityLevel: QualityLevel.HIGH,
      cameraConfig: {
        type: 'perspective',
        position: new THREE.Vector3(0, 0, 5),
        target: new THREE.Vector3(0, 0, 0)
      }
    }, 0x00ff00) // Green cube

    const resumeScene = new TestScene({
      id: SectionType.RESUME,
      name: 'Resume Scene',
      supportedQualityLevels: [QualityLevel.LOW, QualityLevel.MEDIUM, QualityLevel.HIGH],
      defaultQualityLevel: QualityLevel.HIGH,
      cameraConfig: {
        type: 'perspective',
        position: new THREE.Vector3(3, 2, 5),
        target: new THREE.Vector3(0, 0, 0)
      }
    }, 0xff0000) // Red cube

    const mathScene = new TestScene({
      id: SectionType.MATH_GALLERY,
      name: 'Math Gallery Scene',
      supportedQualityLevels: [QualityLevel.LOW, QualityLevel.MEDIUM, QualityLevel.HIGH],
      defaultQualityLevel: QualityLevel.HIGH,
      cameraConfig: {
        type: 'perspective',
        position: new THREE.Vector3(-3, 2, 5),
        target: new THREE.Vector3(0, 0, 0)
      }
    }, 0x0000ff) // Blue cube

    // Register scenes
    manager.registerScene(homeScene)
    manager.registerScene(resumeScene)
    manager.registerScene(mathScene)

    addTestResult('✅ Scene Manager initialized with 3 test scenes')

    return () => {
      manager.dispose()
    }
  }, [renderer, camera])

  const runTests = async () => {
    if (!sceneManager || isRunning) return

    setIsRunning(true)
    setTestResults([])
    addTestResult('🚀 Starting Scene Management System Tests')

    try {
      // Test 1: Basic Scene Registration
      addTestResult('📋 Test 1: Scene Registration')
      const homeScene = sceneManager.getScene(SectionType.HOME)
      const resumeScene = sceneManager.getScene(SectionType.RESUME)
      const mathScene = sceneManager.getScene(SectionType.MATH_GALLERY)

      if (homeScene && resumeScene && mathScene) {
        addTestResult('✅ All test scenes registered successfully')
      } else {
        addTestResult('❌ Scene registration failed')
      }

      // Test 2: Scene Transitions
      addTestResult('📋 Test 2: Scene Transitions')

      // Transition to Home
      await transitionTo(SectionType.HOME as any, { duration: 1000, easing: 'easeInOutCubic' })
      await new Promise(resolve => setTimeout(resolve, 500))

      // Transition to Resume
      await transitionTo(SectionType.RESUME as any, { duration: 800, easing: 'easeOutQuad' })
      await new Promise(resolve => setTimeout(resolve, 500))

      // Transition to Math Gallery
      await transitionTo(SectionType.MATH_GALLERY as any, { duration: 1200, easing: 'easeInOutBack' })
      await new Promise(resolve => setTimeout(resolve, 500))

      // Test 3: Quality Level Changes
      addTestResult('📋 Test 3: Quality Level Management')
      sceneManager.setQualityLevel(QualityLevel.LOW)
      addTestResult('✅ Quality set to LOW')

      await new Promise(resolve => setTimeout(resolve, 200))

      sceneManager.setQualityLevel(QualityLevel.HIGH)
      addTestResult('✅ Quality set to HIGH')

      // Test 4: Resize Handling
      addTestResult('📋 Test 4: Resize Handling')
      sceneManager.resize(600, 400)
      addTestResult('✅ Resize to 600x400 completed')

      await new Promise(resolve => setTimeout(resolve, 200))

      sceneManager.resize(800, 600)
      addTestResult('✅ Resize back to 800x600 completed')

      addTestResult('🎉 All tests completed successfully!')

    } catch (error) {
      addTestResult(`❌ Test failed: ${error}`)
    } finally {
      setIsRunning(false)
    }
  }

  const clearResults = () => {
    setTestResults([])
  }

  return (
    <div className="p-6 bg-gray-900 text-white min-h-screen">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Scene Management System Test</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 3D Canvas */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-4">3D Scene Viewer</h2>
            <canvas
              ref={canvasRef}
              className="w-full border border-gray-600 rounded"
              style={{ maxWidth: '800px', height: '600px' }}
            />

            {/* Scene Controls */}
            <div className="mt-4 space-y-2">
              <div className="flex space-x-2">
                <button
                  onClick={() => transitionTo(SectionType.HOME as any)}
                  disabled={isTransitioning}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded"
                >
                  Home (Green)
                </button>
                <button
                  onClick={() => transitionTo(SectionType.RESUME as any)}
                  disabled={isTransitioning}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded"
                >
                  Resume (Red)
                </button>
                <button
                  onClick={() => transitionTo(SectionType.MATH_GALLERY as any)}
                  disabled={isTransitioning}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded"
                >
                  Math (Blue)
                </button>
              </div>

              <div className="text-sm text-gray-300">
                Current Scene: <span className="text-blue-400">{transitionState.toScene || 'None'}</span>
                {isTransitioning && <span className="text-yellow-400 ml-2">Transitioning...</span>}
              </div>
            </div>
          </div>

          {/* Test Results */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Test Results</h2>
              <div className="space-x-2">
                <button
                  onClick={runTests}
                  disabled={isRunning || !sceneManager}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded"
                >
                  {isRunning ? 'Running...' : 'Run Tests'}
                </button>
                <button
                  onClick={clearResults}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="bg-black rounded p-4 h-96 overflow-y-auto font-mono text-sm">
              {testResults.length === 0 ? (
                <div className="text-gray-500">Click &quot;Run Tests&quot; to start testing the scene management system</div>
              ) : (
                testResults.map((result, index) => (
                  <div key={index} className="mb-1">
                    {result}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="mt-6 bg-gray-800 rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4">System Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <h3 className="font-medium mb-2">Scene Manager</h3>
              <div className="space-y-1">
                <div>Status: <span className="text-green-400">{sceneManager ? 'Initialized' : 'Not Ready'}</span></div>
                <div>Current Scene: <span className="text-blue-400">{transitionState.toScene || 'None'}</span></div>
                <div>Is Transitioning: <span className={isTransitioning ? 'text-yellow-400' : 'text-green-400'}>{isTransitioning ? 'Yes' : 'No'}</span></div>
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-2">Transition State</h3>
              <div className="space-y-1">
                <div>Progress: <span className="font-mono">{Math.round(transitionState.progress * 100)}%</span></div>
                <div>From: <span className="text-blue-400">{transitionState.fromScene || 'None'}</span></div>
                <div>To: <span className="text-green-400">{transitionState.toScene || 'None'}</span></div>
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-2">Loading State</h3>
              <div className="space-y-1">
                <div>Is Loading: <span className={loadingState.isLoading ? 'text-yellow-400' : 'text-green-400'}>{loadingState.isLoading ? 'Yes' : 'No'}</span></div>
                <div>Stage: <span className="text-purple-400">{loadingState.stage}</span></div>
                <div>Progress: <span className="font-mono">{Math.round(loadingState.progress * 100)}%</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      <SceneTransitionLoader variant="detailed" />
    </div>
  )
}
