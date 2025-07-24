'use client'

import React, { useRef, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Text, Html } from '@react-three/drei'
import * as THREE from 'three'
import { SectionType } from '@/types'
import { useNavigation3D } from '@/hooks/useNavigation3D'
import { useCurrentSection, useAppStore } from '@/stores/app-store'
import { group } from 'console'

interface NavigationItem {
  id: SectionType
  label: string
  icon: string
  position: THREE.Vector3
  color: string
}

const navigationItems: NavigationItem[] = [
  {
    id: SectionType.HOME,
    label: 'Home',
    icon: '🏠',
    position: new THREE.Vector3(0, 2, 0),
    color: '#ffffff'
  },
  {
    id: SectionType.RESUME,
    label: 'Resume',
    icon: '📄',
    position: new THREE.Vector3(2, 1, 0),
    color: '#60a5fa'
  },
  {
    id: SectionType.MATH_GALLERY,
    label: 'Math Gallery',
    icon: '🔢',
    position: new THREE.Vector3(1.5, -1.5, 0),
    color: '#34d399'
  },
  {
    id: SectionType.CODE_VISUALIZER,
    label: 'Code Viz',
    icon: '🔍',
    position: new THREE.Vector3(-1.5, -1.5, 0),
    color: '#f59e0b'
  },
  {
    id: SectionType.WASM_DEMOS,
    label: 'WASM Demos',
    icon: '⚡',
    position: new THREE.Vector3(-2, 1, 0),
    color: '#ef4444'
  },
  {
    id: SectionType.SHADER_PLAYGROUND,
    label: 'Shaders',
    icon: '🎨',
    position: new THREE.Vector3(0, -2.5, 0),
    color: '#a855f7'
  }
]

interface NavigationItemProps {
  item: NavigationItem
  isActive: boolean
  onSelect: (section: SectionType) => void
  orbitRadius: number
  angle: number
}

const NavigationItemComponent: React.FC<NavigationItemProps> = ({
  item,
  isActive,
  onSelect,
  orbitRadius,
  angle
}) => {
  const meshRef = useRef<THREE.Mesh>(null)
  const groupRef = useRef<THREE.Group>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const [clicked, setClicked] = useState(false)

  // Enhanced orbital position calculation with more dynamic distribution
  const orbitalPosition = new THREE.Vector3(
    Math.cos(angle) * orbitRadius,
    Math.sin(angle * 0.8) * orbitRadius * 0.5, // Enhanced vertical distribution
    Math.sin(angle) * orbitRadius * 0.7 // Enhanced depth positioning
  )

  useFrame((state) => {
    if (!meshRef.current || !groupRef.current) return

    const time = state.clock.elapsedTime

    // Enhanced hover animation with smooth scaling and glow
    const targetScale = hovered || isActive ? 1.4 : 1.0
    const currentScale = meshRef.current.scale.x
    meshRef.current.scale.setScalar(
      THREE.MathUtils.lerp(currentScale, targetScale, 0.15)
    )

    // Enhanced orbital motion with more dynamic floating
    const floatOffset = Math.sin(time * 1.8 + angle) * 0.18
    const orbitOffset = Math.sin(time * 0.4) * 0.12
    const breathingMotion = Math.sin(time * 2 + angle * 2) * 0.05

    groupRef.current.position.set(
      orbitalPosition.x + Math.cos(time * 0.25 + angle) * orbitOffset,
      orbitalPosition.y + floatOffset + breathingMotion,
      orbitalPosition.z + Math.sin(time * 0.25 + angle) * orbitOffset
    )

    // Enhanced rotation to face camera with dynamic tilt
    groupRef.current.lookAt(state.camera.position)
    groupRef.current.rotateZ(Math.sin(time * 1.2 + angle) * 0.12)

    // Enhanced click animation with multiple pulse waves
    if (clicked) {
      const pulse1 = Math.sin(time * 30) * 0.2 + 1
      const pulse2 = Math.sin(time * 20 + Math.PI / 2) * 0.1 + 1
      meshRef.current.scale.setScalar(targetScale * pulse1 * pulse2)
    }

    // Enhanced active item effects
    if (isActive && ringRef.current) {
      ringRef.current.rotation.z = time * 2.5
      // Add pulsing glow effect
      if (glowRef.current) {
        const glowIntensity = Math.sin(time * 3) * 0.3 + 0.7
        glowRef.current.scale.setScalar(1 + glowIntensity * 0.2)
      }
    }

    // Enhanced hover glow effect
    if (hovered && glowRef.current) {
      const hoverGlow = Math.sin(time * 4) * 0.2 + 0.8
      glowRef.current.scale.setScalar(1 + hoverGlow * 0.15)
    }
  })

  useEffect(() => {
    if (clicked) {
      const timer = setTimeout(() => setClicked(false), 200)
      return () => clearTimeout(timer)
    }
  }, [clicked])

  const handleClick = () => {
    setClicked(true)
    onSelect(item.id)
  }

  return (
    <group
      ref={groupRef}
      position={[orbitalPosition.x, orbitalPosition.y, orbitalPosition.z]}>
      {/* Main navigation sphere with enhanced materials */}
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}>
        <icosahedronGeometry args={[0.35, 1]} />
        <meshStandardMaterial
          color={item.color}
          emissive={item.color}
          emissiveIntensity={isActive ? 0.4 : hovered ? 0.3 : 0.15}
          transparent
          opacity={isActive ? 1.0 : hovered ? 0.95 : 0.8}
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>

      {/* Enhanced outer glow ring */}
      {(hovered || isActive) && (
        <mesh ref={glowRef}>
          <ringGeometry args={[0.45, 0.52, 32]} />
          <meshBasicMaterial
            color={item.color}
            transparent
            opacity={isActive ? 0.7 : 0.5}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Additional glow layers for enhanced effect */}
      {(hovered || isActive) && (
        <>
          <mesh>
            <ringGeometry args={[0.52, 0.58, 32]} />
            <meshBasicMaterial
              color={item.color}
              transparent
              opacity={isActive ? 0.4 : 0.25}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh>
            <ringGeometry args={[0.58, 0.65, 32]} />
            <meshBasicMaterial
              color={item.color}
              transparent
              opacity={isActive ? 0.2 : 0.12}
              side={THREE.DoubleSide}
            />
          </mesh>
        </>
      )}

      {/* Icon */}
      <Text
        position={[0, 0, 0.31]}
        fontSize={0.2}
        color="white"
        anchorX="center"
        anchorY="middle">
        {item.icon}
      </Text>

      {/* Label (appears on hover) */}
      {hovered && (
        <Html
          position={[0, -0.6, 0]}
          center
          style={{
            pointerEvents: 'none',
            userSelect: 'none'
          }}>
          <div className="bg-black/80 text-white px-2 py-1 rounded text-sm whitespace-nowrap">
            {item.label}
          </div>
        </Html>
      )}

      {/* Enhanced selection ring with rotation and multiple layers */}
      {isActive && (
        <>
          <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.5, 0.55, 32]} />
            <meshBasicMaterial
              color={item.color}
              transparent
              opacity={0.9}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* Counter-rotating inner ring */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.38, 0.42, 24]} />
            <meshBasicMaterial
              color={item.color}
              transparent
              opacity={0.6}
              side={THREE.DoubleSide}
            />
          </mesh>
        </>
      )}

      {/* Enhanced particle trail for active item */}
      {isActive && (
        <points>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={30}
              array={
                new Float32Array(
                  Array.from({ length: 90 }, (_, i) => {
                    const t = i / 30
                    const radius = 0.7 + Math.sin(t * Math.PI * 4) * 0.1
                    return [
                      Math.cos(t * Math.PI * 4) * radius,
                      Math.sin(t * Math.PI * 4) * radius,
                      Math.sin(t * Math.PI * 2) * 0.2
                    ]
                  }).flat()
                )
              }
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial
            color={item.color}
            size={0.03}
            transparent
            opacity={0.8}
            sizeAttenuation={true}
          />
        </points>
      )}

      {/* Connection line to center (subtle) */}
      {(hovered || isActive) && (
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={
                new Float32Array([
                  0,
                  0,
                  0,
                  -orbitalPosition.x * 0.7,
                  -orbitalPosition.y * 0.7,
                  -orbitalPosition.z * 0.7
                ])
              }
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial
            color={item.color}
            transparent
            opacity={isActive ? 0.4 : 0.2}
          />
        </line>
      )}
    </group>
  )
}

interface CentralLogoProps {
  onLogoClick: () => void
}

const CentralLogo: React.FC<CentralLogoProps> = ({ onLogoClick }) => {
  const meshRef = useRef<THREE.Mesh>(null)
  const innerRingRef = useRef<THREE.Mesh>(null)
  const outerRingRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)

  useFrame((state) => {
    if (!meshRef.current) return

    const time = state.clock.elapsedTime

    // Enhanced rotation with breathing effect
    meshRef.current.rotation.y = time * 0.6
    meshRef.current.rotation.x = Math.sin(time * 0.3) * 0.1

    // Enhanced hover animation with pulsing
    const breathingScale = Math.sin(time * 2) * 0.05 + 1
    const targetScale = hovered ? 1.15 : 1.0
    const currentScale = meshRef.current.scale.x
    meshRef.current.scale.setScalar(
      THREE.MathUtils.lerp(currentScale, targetScale * breathingScale, 0.12)
    )

    // Animate orbital rings
    if (innerRingRef.current) {
      innerRingRef.current.rotation.z = time * 0.8
    }
    if (outerRingRef.current) {
      outerRingRef.current.rotation.z = -time * 0.5
    }
  })

  return (
    <group>
      {/* Central logo sphere */}
      <mesh
        ref={meshRef}
        onClick={onLogoClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}>
        <icosahedronGeometry args={[0.5, 1]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={hovered ? 0.2 : 0.1}
          wireframe
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Logo text */}
      <Text
        position={[0, 0, 0]}
        fontSize={0.15}
        color="white"
        anchorX="center"
        anchorY="middle">
        MD
      </Text>

      {/* Enhanced orbital rings with animation */}
      <mesh ref={innerRingRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.5, 1.52, 64]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={hovered ? 0.15 : 0.08}
        />
      </mesh>

      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.0, 2.02, 64]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={hovered ? 0.12 : 0.06}
        />
      </mesh>

      <mesh ref={outerRingRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.5, 2.52, 64]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={hovered ? 0.1 : 0.04}
        />
      </mesh>

      {/* Additional decorative elements */}
      {hovered && (
        <>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.2, 1.25, 32]} />
            <meshBasicMaterial color="#60a5fa" transparent opacity={0.3} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[2.8, 2.85, 32]} />
            <meshBasicMaterial color="#34d399" transparent opacity={0.2} />
          </mesh>
        </>
      )}
    </group>
  )
}

interface Navigation3DSceneProps {
  currentSection: SectionType
  onSectionChange: (section: SectionType) => void
  isVisible: boolean
  isCompact: boolean
  isMobile: boolean
}

const Navigation3DScene: React.FC<Navigation3DSceneProps> = ({
  currentSection,
  onSectionChange,
  isVisible,
  isCompact,
  isMobile
}) => {
  const { camera } = useThree()

  // Responsive orbit radius
  const orbitRadius = isMobile ? 2.0 : isCompact ? 2.2 : 2.5

  useEffect(() => {
    // Set up camera position for navigation view
    const cameraDistance = isMobile ? 4 : 5
    camera.position.set(0, 0, cameraDistance)
    camera.lookAt(0, 0, 0)
  }, [camera, isMobile])

  const handleLogoClick = () => {
    onSectionChange(SectionType.HOME)
  }

  // Debug logging removed to prevent infinite render loop

  return (
    <group visible={isVisible}>
      {/* Enhanced lighting setup */}
      <ambientLight intensity={0.3} />
      <pointLight position={[8, 8, 8]} intensity={0.9} color="#ffffff" />
      <pointLight position={[-8, -8, -8]} intensity={0.5} color="#4f46e5" />
      <pointLight position={[0, 10, -5]} intensity={0.3} color="#34d399" />

      {/* Subtle directional light for depth */}
      <directionalLight position={[5, 5, 5]} intensity={0.2} color="#60a5fa" />

      {/* Central logo */}
      <CentralLogo onLogoClick={handleLogoClick} />

      {/* Navigation items */}
      {navigationItems.map((item, index) => {
        const angle = (index / navigationItems.length) * Math.PI * 2
        return (
          <NavigationItemComponent
            key={item.id}
            item={item}
            isActive={currentSection === item.id}
            onSelect={onSectionChange}
            orbitRadius={orbitRadius}
            angle={angle}
          />
        )
      })}

      {/* Enhanced background particles with performance optimization */}
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={isMobile ? 50 : isCompact ? 75 : 120}
            array={
              new Float32Array(
                Array.from(
                  { length: (isMobile ? 50 : isCompact ? 75 : 120) * 3 },
                  () => (Math.random() - 0.5) * 25
                )
              )
            }
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#ffffff"
          size={isMobile ? 0.008 : 0.012}
          transparent
          opacity={0.4}
          sizeAttenuation={true}
        />
      </points>

      {/* Additional colored particles for depth */}
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={isMobile ? 20 : 40}
            array={
              new Float32Array(
                Array.from(
                  { length: (isMobile ? 20 : 40) * 3 },
                  () => (Math.random() - 0.5) * 30
                )
              )
            }
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#60a5fa"
          size={isMobile ? 0.006 : 0.01}
          transparent
          opacity={0.2}
          sizeAttenuation={true}
        />
      </points>
    </group>
  )
}

interface Navigation3DProps {
  className?: string
  autoHide?: boolean
  hideDelay?: number
}

export const Navigation3D: React.FC<Navigation3DProps> = ({
  className = '',
  autoHide = false,
  hideDelay = 3000
}) => {
  // Fallback to simpler state management if hook fails
  const [isVisible, setIsVisible] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [isCompact, setIsCompact] = useState(false)

  // Try to use the hook, but fallback if it fails
  let hookResult
  try {
    hookResult = useNavigation3D({ autoHide, hideDelay })
  } catch (error) {
    console.error('useNavigation3D hook failed:', error)
    hookResult = null
  }

  // Use hook result if available, otherwise use fallback
  const currentSection = hookResult?.currentSection || useCurrentSection()
  const isTransitioning = hookResult?.isTransitioning || false
  const { setCurrentSection } = useAppStore()

  const navigateToSection =
    hookResult?.navigateToSection ||
    ((section: SectionType) => {
      console.log('Fallback navigation to:', section)
      setCurrentSection(section)
    })

  const toggleVisibility =
    hookResult?.toggleVisibility ||
    (() => {
      setIsVisible((prev) => !prev)
    })

  // Detect screen size
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth
      setIsMobile(width < 768)
      setIsCompact(width < 1024)
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  // Use hook values if available, otherwise use local state
  const finalIsVisible = hookResult?.isVisible ?? isVisible
  const finalIsMobile = hookResult?.isMobile ?? isMobile
  const finalIsCompact = hookResult?.isCompact ?? isCompact

  // Debug logging (removed to prevent infinite render loop)

  // Enhanced keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!finalIsVisible || isTransitioning) return

      const currentIndex = navigationItems.findIndex(
        (item) => item.id === currentSection
      )

      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          event.preventDefault()
          const nextIndex = (currentIndex + 1) % navigationItems.length
          navigateToSection(navigationItems[nextIndex].id)
          break
        case 'ArrowLeft':
        case 'ArrowUp':
          event.preventDefault()
          const prevIndex =
            currentIndex === 0 ? navigationItems.length - 1 : currentIndex - 1
          navigateToSection(navigationItems[prevIndex].id)
          break
        case 'Enter':
        case ' ':
          event.preventDefault()
          // Re-select current section (useful for screen readers)
          navigateToSection(currentSection)
          break
        case 'Escape':
          event.preventDefault()
          if (finalIsMobile) {
            toggleVisibility()
          }
          break
        case 'Home':
          event.preventDefault()
          navigateToSection(SectionType.HOME)
          break
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
          event.preventDefault()
          const itemIndex = parseInt(event.key) - 1
          if (itemIndex < navigationItems.length) {
            navigateToSection(navigationItems[itemIndex].id)
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    finalIsVisible,
    isTransitioning,
    currentSection,
    navigateToSection,
    toggleVisibility,
    finalIsMobile
  ])

  // Enhanced responsive sizing with better breakpoints
  const getNavigationSize = () => {
    if (finalIsMobile) return 'w-72 h-72 sm:w-80 sm:h-80'
    if (finalIsCompact) return 'w-80 h-80 lg:w-96 lg:h-96'
    return 'w-96 h-96 xl:w-[28rem] xl:h-[28rem]'
  }

  // Enhanced responsive positioning with better mobile support
  const getNavigationPosition = () => {
    if (finalIsMobile) return 'top-2 right-2 sm:top-3 sm:right-3'
    if (finalIsCompact) return 'top-3 right-3 lg:top-4 lg:right-4'
    return 'top-4 right-4 xl:top-6 xl:right-6'
  }

  return (
    <>


      {/* Enhanced navigation toggle button for mobile with better accessibility */}
      {finalIsMobile && (
        <button
          onClick={toggleVisibility}
          className={`fixed top-4 right-4 z-50 bg-black/60 text-white p-3 rounded-full backdrop-blur-md border border-white/30 transition-all duration-300 hover:bg-black/80 hover:scale-110 active:scale-95 ${
            finalIsVisible ? 'rotate-90' : 'rotate-0'
          }`}
          aria-label={
            finalIsVisible ? 'Close navigation menu' : 'Open navigation menu'
          }
          aria-expanded={finalIsVisible}>
          <svg
            className={`w-6 h-6 transition-transform duration-300 ${
              finalIsVisible ? 'rotate-45' : 'rotate-0'
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24">
            {finalIsVisible ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      )}

      {/* 3D Navigation Menu with enhanced accessibility */}
      <nav
        className={`fixed inset-0 pointer-events-none z-40 ${className}`}
        role="navigation"
        aria-label="3D Portfolio Navigation">
        <div
          className={`absolute ${getNavigationPosition()} ${getNavigationSize()} pointer-events-auto transition-all duration-500 ${
            finalIsVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          } ${isTransitioning ? 'pointer-events-none' : ''}`}
          role="menu"
          aria-hidden={!finalIsVisible}
          tabIndex={finalIsVisible ? 0 : -1}>
          <Canvas
            camera={{
              position: [0, 0, finalIsMobile ? 4 : 5],
              fov: finalIsMobile ? 60 : 50,
              near: 0.1,
              far: 100
            }}
            gl={{
              alpha: true,
              antialias: !finalIsMobile,
              powerPreference: finalIsMobile ? 'low-power' : 'high-performance',
              stencil: false,
              depth: true,
              logarithmicDepthBuffer: false
            }}
            dpr={finalIsMobile ? 1 : Math.min(window.devicePixelRatio, 2)}
            performance={{
              min: 0.5,
              max: 1,
              debounce: 200
            }}
            onCreated={(state) => {
              console.log('Canvas created:', state)
            }}
            fallback={
              <div className="text-white p-4">Loading 3D Navigation...</div>
            }>
            <Navigation3DScene
              currentSection={currentSection}
              onSectionChange={navigateToSection}
              isVisible={finalIsVisible}
              isCompact={finalIsCompact}
              isMobile={finalIsMobile}
            />
          </Canvas>
        </div>

        {/* Screen reader instructions */}
        <div className="sr-only">
          <p>
            Use arrow keys to navigate between sections, Enter to select, Escape
            to close on mobile, or number keys 1-6 for direct access.
          </p>
          <p>
            Current section:{' '}
            {navigationItems.find((item) => item.id === currentSection)?.label}
          </p>
        </div>
      </nav>
    </>
  )
}

export default Navigation3D
