'use client'

import React, { useRef, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Text, Html } from '@react-three/drei'
import * as THREE from 'three'
import { SectionType } from '@/types'
import { useNavigation3D } from '@/hooks/useNavigation3D'
import { useCurrentSection, useAppStore } from '@/stores/app-store'
import { navigationController } from '@/lib/navigation-controller'
import { KeyboardHelpModal } from './KeyboardHelpModal'

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

    // Enhanced orbital motion with more dynamic floating and depth
    const floatOffset = Math.sin(time * 1.8 + angle) * 0.18
    const orbitOffset = Math.sin(time * 0.4) * 0.12
    const breathingMotion = Math.sin(time * 2 + angle * 2) * 0.05
    const depthWave = Math.cos(time * 0.6 + angle * 1.5) * 0.3

    groupRef.current.position.set(
      orbitalPosition.x + Math.cos(time * 0.25 + angle) * orbitOffset,
      orbitalPosition.y + floatOffset + breathingMotion,
      orbitalPosition.z +
        Math.sin(time * 0.25 + angle) * orbitOffset +
        depthWave
    )

    // Enhanced rotation to face camera with dynamic tilt and wobble
    const cameraDirection = state.camera.position
      .clone()
      .sub(groupRef.current.position)
      .normalize()
    groupRef.current.lookAt(state.camera.position)
    groupRef.current.rotateZ(Math.sin(time * 1.2 + angle) * 0.12)
    groupRef.current.rotateX(Math.sin(time * 0.8 + angle * 0.5) * 0.05)

    // Enhanced click animation with multiple pulse waves and color shift
    if (clicked) {
      const pulse1 = Math.sin(time * 30) * 0.2 + 1
      const pulse2 = Math.sin(time * 20 + Math.PI / 2) * 0.1 + 1
      const pulse3 = Math.sin(time * 40 + Math.PI) * 0.05 + 1
      meshRef.current.scale.setScalar(targetScale * pulse1 * pulse2 * pulse3)
    }

    // Enhanced active item effects with multiple rotating rings
    if (isActive && ringRef.current) {
      ringRef.current.rotation.z = time * 2.5
      ringRef.current.rotation.x = Math.sin(time * 1.5) * 0.1
      ringRef.current.rotation.y = Math.cos(time * 1.8) * 0.1

      // Add pulsing glow effect with color cycling
      if (glowRef.current) {
        const glowIntensity = Math.sin(time * 3) * 0.3 + 0.7
        const colorShift = Math.sin(time * 2) * 0.1
        glowRef.current.scale.setScalar(1 + glowIntensity * 0.2)
      }
    }

    // Enhanced hover glow effect with ripple animation
    if (hovered && glowRef.current) {
      const hoverGlow = Math.sin(time * 4) * 0.2 + 0.8
      const ripple = Math.sin(time * 6 + angle) * 0.05 + 1
      glowRef.current.scale.setScalar((1 + hoverGlow * 0.15) * ripple)
    }

    // Add subtle rotation to the main mesh for more dynamic feel
    meshRef.current.rotation.y = time * 0.5 + angle
    meshRef.current.rotation.x = Math.sin(time * 0.7 + angle) * 0.1
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
      {/* Main navigation sphere with enhanced materials and geometry */}
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}>
        <icosahedronGeometry args={[0.35, 2]} />
        <meshStandardMaterial
          color={item.color}
          emissive={item.color}
          emissiveIntensity={isActive ? 0.4 : hovered ? 0.3 : 0.15}
          transparent
          opacity={isActive ? 1.0 : hovered ? 0.95 : 0.8}
          roughness={0.2}
          metalness={0.3}
          envMapIntensity={0.5}
        />
      </mesh>

      {/* Inner core with different material for depth */}
      <mesh scale={0.7}>
        <icosahedronGeometry args={[0.35, 1]} />
        <meshStandardMaterial
          color={item.color}
          emissive={item.color}
          emissiveIntensity={isActive ? 0.6 : hovered ? 0.4 : 0.2}
          transparent
          opacity={0.3}
          roughness={0.1}
          metalness={0.8}
        />
      </mesh>

      {/* Wireframe overlay for tech aesthetic */}
      <mesh scale={1.05}>
        <icosahedronGeometry args={[0.35, 1]} />
        <meshBasicMaterial
          color={item.color}
          wireframe
          transparent
          opacity={isActive ? 0.4 : hovered ? 0.3 : 0.1}
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

    // Enhanced rotation with complex motion patterns
    meshRef.current.rotation.y = time * 0.6
    meshRef.current.rotation.x = Math.sin(time * 0.3) * 0.1
    meshRef.current.rotation.z = Math.cos(time * 0.4) * 0.05

    // Enhanced hover animation with multi-layered pulsing
    const breathingScale = Math.sin(time * 2) * 0.05 + 1
    const secondaryPulse = Math.sin(time * 3.2) * 0.02 + 1
    const targetScale = hovered ? 1.15 : 1.0
    const currentScale = meshRef.current.scale.x
    meshRef.current.scale.setScalar(
      THREE.MathUtils.lerp(
        currentScale,
        targetScale * breathingScale * secondaryPulse,
        0.12
      )
    )

    // Animate orbital rings with complex patterns
    if (innerRingRef.current) {
      innerRingRef.current.rotation.z = time * 0.8
      innerRingRef.current.rotation.x = Math.sin(time * 0.5) * 0.1
      innerRingRef.current.scale.setScalar(1 + Math.sin(time * 2.5) * 0.05)
    }
    if (outerRingRef.current) {
      outerRingRef.current.rotation.z = -time * 0.5
      outerRingRef.current.rotation.y = Math.cos(time * 0.3) * 0.1
      outerRingRef.current.scale.setScalar(1 + Math.cos(time * 1.8) * 0.03)
    }
  })

  return (
    <group>
      {/* Central logo sphere with multiple layers */}
      <mesh
        ref={meshRef}
        onClick={onLogoClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}>
        <icosahedronGeometry args={[0.5, 2]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={hovered ? 0.3 : 0.15}
          wireframe
          transparent
          opacity={0.8}
          roughness={0.1}
          metalness={0.2}
        />
      </mesh>

      {/* Inner solid core */}
      <mesh scale={0.8}>
        <icosahedronGeometry args={[0.5, 1]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#60a5fa"
          emissiveIntensity={hovered ? 0.4 : 0.2}
          transparent
          opacity={0.3}
          roughness={0.0}
          metalness={0.9}
        />
      </mesh>

      {/* Outer energy field */}
      <mesh scale={1.2}>
        <icosahedronGeometry args={[0.5, 0]} />
        <meshBasicMaterial
          color="#34d399"
          transparent
          opacity={hovered ? 0.15 : 0.05}
          wireframe
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
      {/* Enhanced lighting setup with dynamic colors */}
      <ambientLight intensity={0.2} color="#f0f8ff" />

      {/* Main key light */}
      <pointLight
        position={[8, 8, 8]}
        intensity={1.2}
        color="#ffffff"
        castShadow={false}
        decay={2}
        distance={50}
      />

      {/* Fill light with color */}
      <pointLight
        position={[-8, -8, -8]}
        intensity={0.6}
        color="#4f46e5"
        decay={2}
        distance={40}
      />

      {/* Rim light for depth */}
      <pointLight
        position={[0, 10, -5]}
        intensity={0.4}
        color="#34d399"
        decay={2}
        distance={30}
      />

      {/* Subtle directional light for overall illumination */}
      <directionalLight
        position={[5, 5, 5]}
        intensity={0.3}
        color="#60a5fa"
        castShadow={false}
      />

      {/* Additional accent lights for more dynamic lighting */}
      <pointLight
        position={[0, -8, 8]}
        intensity={0.3}
        color="#f59e0b"
        decay={2}
        distance={25}
      />

      <pointLight
        position={[8, 0, -8]}
        intensity={0.25}
        color="#ef4444"
        decay={2}
        distance={20}
      />

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

      {/* Enhanced background particles with multiple layers */}
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
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Mid-layer colored particles */}
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
          opacity={0.3}
          sizeAttenuation={true}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Foreground accent particles */}
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={isMobile ? 15 : 25}
            array={
              new Float32Array(
                Array.from(
                  { length: (isMobile ? 15 : 25) * 3 },
                  () => (Math.random() - 0.5) * 20
                )
              )
            }
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#34d399"
          size={isMobile ? 0.004 : 0.008}
          transparent
          opacity={0.6}
          sizeAttenuation={true}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Distant background particles for depth */}
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={isMobile ? 30 : 60}
            array={
              new Float32Array(
                Array.from(
                  { length: (isMobile ? 30 : 60) * 3 },
                  () => (Math.random() - 0.5) * 40
                )
              )
            }
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#a855f7"
          size={isMobile ? 0.003 : 0.005}
          transparent
          opacity={0.15}
          sizeAttenuation={true}
          blending={THREE.AdditiveBlending}
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
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false)

  // Always call hooks in the same order
  const hookResult = useNavigation3D({ autoHide, hideDelay })
  const fallbackCurrentSection = useCurrentSection()
  const { setCurrentSection } = useAppStore()

  // Use hook result if available, otherwise use fallback
  const currentSection = hookResult?.currentSection || fallbackCurrentSection
  const isTransitioning = hookResult?.isTransitioning || false

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

  // Keyboard navigation is now handled by the enhanced useNavigation3D hook

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

  // Handle keyboard help modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === '?' && !showKeyboardHelp) {
        event.preventDefault()
        setShowKeyboardHelp(true)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showKeyboardHelp])

  return (
    <>
      {/* Keyboard Help Modal */}
      <KeyboardHelpModal
        isOpen={showKeyboardHelp}
        onClose={() => setShowKeyboardHelp(false)}
      />

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

        {/* Enhanced screen reader instructions */}
        <div className="sr-only">
          <h2>3D Portfolio Navigation</h2>
          <p>
            Interactive 3D navigation menu for Manav Dhindsa&apos;s portfolio.
            Use keyboard shortcuts for navigation:
          </p>
          <ul>
            <li>Arrow keys or J/K: Navigate between sections</li>
            <li>Home or H: Go to home section</li>
            <li>End: Go to last section</li>
            <li>Number keys 1-6: Jump to specific section</li>
            <li>Enter or Space: Select current section</li>
            <li>Escape: Toggle navigation menu (mobile)</li>
            <li>P: Preload next section</li>
            <li>?: Show keyboard help</li>
          </ul>
          <p>
            Current section:{' '}
            {navigationItems.find((item) => item.id === currentSection)?.label}
            {hookResult?.currentRoute &&
              ` - ${hookResult.currentRoute.description}`}
          </p>
          <p>
            Navigation status: {isTransitioning ? 'Transitioning' : 'Ready'}
          </p>
        </div>
      </nav>
    </>
  )
}

export default Navigation3D
