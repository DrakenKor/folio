import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { SceneManager } from '@/lib/scene-management/SceneManager'
import { Scene3D, SceneType } from '@/lib/scene-management/types'
import { QualityLevel } from '@/types'
import { useAppStore } from '@/stores/app-store'

interface UseSceneManagerOptions {
  containerId: string
  defaultQuality?: QualityLevel
  antialias?: boolean
  alpha?: boolean
}

interface UseSceneManagerResult {
  sceneManager: SceneManager | null
  renderer: THREE.WebGLRenderer | null
  camera: THREE.PerspectiveCamera | null
  containerRef: React.RefObject<HTMLDivElement>
  isInitialized: boolean
  registerScene: (scene: Scene3D) => void
  transitionToScene: (sceneType: SceneType) => Promise<void>
}

/**
 * Hook to use the SceneManager in React components
 */
export function useSceneManager({
  containerId,
  defaultQuality = QualityLevel.HIGH,
  antialias = true,
  alpha = false
}: UseSceneManagerOptions): UseSceneManagerResult {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const sceneManagerRef = useRef<SceneManager | null>(null)

  const { setQualityLevel } = useAppStore()

  // Initialize scene manager
  useEffect(() => {
    if (!containerRef.current) return

    // Create renderer
    const renderer = new THREE.WebGLRenderer({
      antialias,
      alpha,
      powerPreference: 'high-performance'
    })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Create camera
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    )
    camera.position.z = 5
    cameraRef.current = camera

    // Initialize scene manager
    const sceneManager = SceneManager.getInstance()
    sceneManager.initialize(renderer, camera, defaultQuality)
    sceneManagerRef.current = sceneManager

    // Set quality level in app store
    setQualityLevel(defaultQuality)

    // Handle resize events
    const handleResize = () => {
      if (!containerRef.current || !renderer || !sceneManager) return

      const width = containerRef.current.clientWidth
      const height = containerRef.current.clientHeight

      renderer.setSize(width, height)
      sceneManager.resize(width, height)
    }

    window.addEventListener('resize', handleResize)
    setIsInitialized(true)

    // Clean up
    return () => {
      window.removeEventListener('resize', handleResize)

      if (renderer && containerRef.current) {
        containerRef.current.removeChild(renderer.domElement)
        renderer.dispose()
      }

      if (sceneManager) {
        sceneManager.dispose()
      }
    }
  }, [containerId, defaultQuality, antialias, alpha, setQualityLevel])

  // Register a scene with the scene manager
  const registerScene = (scene: Scene3D) => {
    if (!sceneManagerRef.current) return
    sceneManagerRef.current.registerScene(scene)
  }

  // Transition to a scene
  const transitionToScene = async (sceneType: SceneType) => {
    if (!sceneManagerRef.current) return
    await sceneManagerRef.current.transitionTo(sceneType)
  }

  return {
    sceneManager: sceneManagerRef.current,
    renderer: rendererRef.current,
    camera: cameraRef.current,
    containerRef,
    isInitialized,
    registerScene,
    transitionToScene
  }
}
