'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { SceneManager } from '@/lib/scene-management/SceneManager'
import { BaseScene3D } from '@/lib/scene-management/BaseScene3D'
import { SceneTransitionManager } from '@/lib/scene-management/SceneTransitionManager'
import { QualityLevel, SectionType } from '@/types'

// Simple test scene with a colored rotating cube
class SimpleTestScene extends BaseScene3D {
  private cube: THREE.Mesh | null = null
  private light: THREE.DirectionalLight | null = null

  constructor(id: string, name: string, color: number, position: THREE.Vector3) {
    super({
      id,
      name,
      supportedQualityLevels: [QualityLevel.LOW, QualityLevel.MEDIUM, QualityLevel.HIGH],
      defaultQualityLevel: QualityLevel.HIGH,
      cameraConfig: {
        type: 'perspective',
        position,
        target: new THREE.Vector3(0, 0, 0)
      }
    })

    // Create a colored cube
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = new THREE.MeshPhongMaterial({ color })
    this.cube = new THREE.Mesh(geometry, material)
    this.scene.add(this.cube)

    // Add lighting
    this.light = new THREE.DirectionalLight(0xffffff, 1)
    this.light.position.set(5, 5, 5)
    this.scene.add(this.light)

    const ambientLight = new THREE.AmbientLight(0x404040, 0.4)
    this.scene.add(ambientLight)
  }

  protected async onInitialize(): Promise<void> {
    console.log(`✅ Initialized scene: ${this.name}`)
  }

  protected async onActivate(): Promise<void> {
    console.log(`🟢 Activated scene: ${this.name}`)
  }

  protected async onDeactivate(): Promise<void> {
    console.log(`🔴 Deactivated scene: ${this.name}`)
  }

  protected onUpdate(deltaTime: number): void {
    if (this.cube) {
      this.cube.rotation.x += deltaTime * 0.5
      this.cube.rotation.y += deltaTime * 0.3
    }
  }

  protected onBeforeRender(): void {}
  protected onAfterRender(): void {}
  protected onResize(): void {}
  protected onCleanup(): void {
    if (this.cube) {
      this.cube.geometry.dispose()
      if (this.cube.material instanceof THREE.Material) {
        this.cube.material.dispose()
      }
    }
  }
  protected onQualityChange(level: QualityLevel): void {
    console.log(`🎚️ Quality changed to ${level} for ${this.name}`)
  }
}

export default function SimpleTestPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [sceneManager, setSceneManager] = useState<SceneManager | null>(null)
  const [transitionManager, setTransitionManager] = useState<SceneTransitionManager | null>(null)
  const [currentScene, setCurrentScene] = useState<string>('none')
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [testResults, setTestResults] = useState<string[]>([])

  const addResult = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setTestResults(prev => [...prev, `${timestamp}: ${message}`])
    console.log(message)
  }

  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    renderer.setSize(600, 400)
    renderer.setClearColor(0x000011)

    const camera = new THREE.PerspectiveCamera(75, 600 / 400, 0.1, 1000)
    camera.position.set(0, 0, 3)

    // Initialize Scene Manager
    const sm = SceneManager.getInstance()
    sm.initialize(renderer, camera, QualityLevel.HIGH)
    setSceneManager(sm)

    // Initialize Transition Manager
    const tm = SceneTransitionManager.getInstance()
    tm.setCallbacks({
      onStart: (from, to) => {
        addResult(`🚀 Transition started: ${from || 'none'} → ${to}`)
        setIsTransitioning(true)
      },
      onComplete: (scene) => {
        addResult(`✅ Transition completed to: ${scene}`)
        setCurrentScene(scene)
        setIsTransitioning(false)
      },
      onError: (error) => {
        addResult(`❌ Transition error: ${error.message}`)
        setIsTransitioning(false)
      }
    })
    setTransitionManager(tm)

    // Create test scenes
    const homeScene = new SimpleTestScene(
      SectionType.HOME,
      'Home Scene',
      0x00ff00, // Green
      new THREE.Vector3(0, 0, 3)
    )

    const resumeScene = new SimpleTestScene(
      SectionType.RESUME,
      'Resume Scene',
      0xff0000, // Red
      new THREE.Vector3(2, 1, 3)
    )

    const mathScene = new SimpleTestScene(
      SectionType.MATH_GALLERY,
      'Math Gallery Scene',
      0x0000ff, // Blue
      new THREE.Vector3(-2, 1, 3)
    )

    // Register scenes
    sm.registerScene(homeScene)
    sm.registerScene(resumeScene)
    sm.registerScene(mathScene)

    addResult('🎯 Scene Manager initialized with 3 test scenes')

    // Start with home scene
    setTimeout(() => {
      tm.transitionTo(SectionType.HOME as any, { duration: 1000, easing: 'easeInOutCubic' })
    }, 500)

    return () => {
      sm.dispose()
      tm.dispose()
    }
  }, [])

  const handleSceneTransition = async (sceneType: string, easingType: string = 'easeInOutCubic') => {
    if (!transitionManager || isTransitioning) return

    try {
      await transitionManager.transitionTo(sceneType as any, {
        duration: 1200,
        easing: easingType
      })
    } catch (error) {
      addResult(`❌ Failed to transition: ${error}`)
    }
  }

  const runTests = async () => {
    if (!sceneManager || !transitionManager) return

    addResult('🧪 Running automated tests...')

    // Test 1: Scene registration
    const homeScene = sceneManager.getScene(SectionType.HOME)
    const resumeScene = sceneManager.getScene(SectionType.RESUME)
    const mathScene = sceneManager.getScene(SectionType.MATH_GALLERY)

    if (homeScene && resumeScene && mathScene) {
      addResult('✅ Test 1: All scenes registered successfully')
    } else {
      addResult('❌ Test 1: Scene registration failed')
    }

    // Test 2: Quality level changes
    sceneManager.setQualityLevel(QualityLevel.LOW)
    addResult('✅ Test 2: Quality set to LOW')

    await new Promise(resolve => setTimeout(resolve, 500))

    sceneManager.setQualityLevel(QualityLevel.HIGH)
    addResult('✅ Test 2: Quality set to HIGH')

    // Test 3: Resize handling
    sceneManager.resize(400, 300)
    addResult('✅ Test 3: Resize to 400x300')

    await new Promise(resolve => setTimeout(resolve, 200))

    sceneManager.resize(600, 400)
    addResult('✅ Test 3: Resize back to 600x400')

    addResult('🎉 All tests completed!')
  }

  return (
    <div className="p-6 bg-gray-900 text-white min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Simple Scene Management Test</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 3D Canvas */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-4">3D Scene Viewer</h2>
            <canvas
              ref={canvasRef}
              className="w-full border border-gray-600 rounded"
              style={{ maxWidth: '600px', height: '400px' }}
            />

            {/* Controls */}
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleSceneTransition(SectionType.HOME, 'easeInOutCubic')}
                  disabled={isTransitioning}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded text-sm"
                >
                  Home (Green)
                </button>
                <button
                  onClick={() => handleSceneTransition(SectionType.RESUME, 'easeOutBounce')}
                  disabled={isTransitioning}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded text-sm"
                >
                  Resume (Red)
                </button>
                <button
                  onClick={() => handleSceneTransition(SectionType.MATH_GALLERY, 'easeInOutBack')}
                  disabled={isTransitioning}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm"
                >
                  Math (Blue)
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={runTests}
                  disabled={isTransitioning}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded text-sm"
                >
                  Run Tests
                </button>
                <button
                  onClick={() => setTestResults([])}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-sm"
                >
                  Clear Log
                </button>
              </div>

              <div className="text-sm">
                <div>Current Scene: <span className="text-blue-400">{currentScene}</span></div>
                <div>Status: <span className={isTransitioning ? 'text-yellow-400' : 'text-green-400'}>
                  {isTransitioning ? 'Transitioning...' : 'Ready'}
                </span></div>
              </div>
            </div>
          </div>

          {/* Test Results */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-4">Test Results</h2>
            <div className="bg-black rounded p-3 h-96 overflow-y-auto font-mono text-sm">
              {testResults.length === 0 ? (
                <div className="text-gray-500">
                  Click buttons to test scene transitions or &quot;Run Tests&quot; for automated testing
                </div>
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

        {/* Instructions */}
        <div className="mt-6 bg-gray-800 rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-3">How to Test</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-medium mb-2 text-green-400">✅ What Should Work:</h3>
              <ul className="space-y-1 text-gray-300">
                <li>• Smooth scene transitions with different easing</li>
                <li>• Rotating colored cubes (Green, Red, Blue)</li>
                <li>• Camera movement between positions</li>
                <li>• Console logging of events</li>
                <li>• Automated test execution</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium mb-2 text-blue-400">🔍 What to Observe:</h3>
              <ul className="space-y-1 text-gray-300">
                <li>• Smooth camera transitions (no jumps)</li>
                <li>• Different easing curves per button</li>
                <li>• Real-time status updates</li>
                <li>• Console messages in browser dev tools</li>
                <li>• No errors in the console</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
