'use client'

import React, { useRef, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Text, Html } from '@react-three/drei'
import * as THREE from 'three'
import { SectionType } from '@/types'
import { useNavigation3D } from '@/hooks/useNavigation3D'

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
  const [hovered, setHovered] = useState(false)
  const [clicked, setClicked] = useState(false)

  // Calculate orbital position
  const orbitalPosition = new THREE.Vector3(
    Math.cos(angle) * orbitRadius,
    Math.sin(angle) * orbitRadius * 0.3, // Flatten the orbit slightly
    Math.sin(angle) * orbitRadius * 0.5
  )

  useFrame((state) => {
    if (!meshRef.current || !groupRef.current) return

    // Smooth hover animation
    const targetScale = hovered || isActive ? 1.2 : 1.0
    const currentScale = meshRef.current.scale.x
    meshRef.current.scale.setScalar(
      THREE.MathUtils.lerp(currentScale, targetScale, 0.1)
    )

    // Gentle floating animation
    const time = state.clock.elapsedTime
    groupRef.current.position.y = orbitalPosition.y + Math.sin(time * 2 + angle) * 0.1

    // Rotate to face camera
    groupRef.current.lookAt(state.camera.position)

    // Click animation
    if (clicked) {
      const pulse = Math.sin(time * 20) * 0.1 + 1
      meshRef.current.scale.setScalar(targetScale * pulse)
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
      position={[orbitalPosition.x, orbitalPosition.y, orbitalPosition.z]}
    >
      {/* Main navigation sphere */}
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshStandardMaterial
          color={item.color}
          emissive={item.color}
          emissiveIntensity={isActive ? 0.3 : hovered ? 0.2 : 0.1}
          transparent
          opacity={isActive ? 1.0 : hovered ? 0.9 : 0.7}
        />
      </mesh>

      {/* Icon */}
      <Text
        position={[0, 0, 0.31]}
        fontSize={0.2}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
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
          }}
        >
          <div className="bg-black/80 text-white px-2 py-1 rounded text-sm whitespace-nowrap">
            {item.label}
          </div>
        </Html>
      )}

      {/* Selection ring */}
      {isActive && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.4, 0.45, 32]} />
          <meshBasicMaterial
            color={item.color}
            transparent
            opacity={0.6}
          />
        </mesh>
      )}

      {/* Particle trail for active item */}
      {isActive && (
        <points>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={20}
              array={new Float32Array(
                Array.from({ length: 60 }, (_, i) => {
                  const t = i / 20
                  return [
                    Math.cos(t * Math.PI * 2) * 0.6,
                    Math.sin(t * Math.PI * 2) * 0.6,
                    0
                  ]
                }).flat()
              )}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial
            color={item.color}
            size={0.02}
            transparent
            opacity={0.6}
          />
        </points>
      )}
    </group>
  )
}

interface CentralLogoProps {
  onLogoClick: () => void
}

const CentralLogo: React.FC<CentralLogoProps> = ({ onLogoClick }) => {
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)

  useFrame((state) => {
    if (!meshRef.current) return

    // Gentle rotation
    meshRef.current.rotation.y = state.clock.elapsedTime * 0.5

    // Hover animation
    const targetScale = hovered ? 1.1 : 1.0
    const currentScale = meshRef.current.scale.x
    meshRef.current.scale.setScalar(
      THREE.MathUtils.lerp(currentScale, targetScale, 0.1)
    )
  })

  return (
    <group>
      {/* Central logo sphere */}
      <mesh
        ref={meshRef}
        onClick={onLogoClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
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
        anchorY="middle"
        font="/fonts/inter-bold.woff"
      >
        MD
      </Text>

      {/* Orbital rings */}
      {[1.5, 2.0, 2.5].map((radius, index) => (
        <mesh key={index} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius, radius + 0.01, 64]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.1 - index * 0.02}
          />
        </mesh>
      ))}
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

  return (
    <group visible={isVisible}>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={0.8} />
      <pointLight position={[-10, -10, -10]} intensity={0.4} color="#4f46e5" />

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

      {/* Background particles */}
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={100}
            array={new Float32Array(
              Array.from({ length: 300 }, () => (Math.random() - 0.5) * 20)
            )}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#ffffff"
          size={0.01}
          transparent
          opacity={0.3}
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
  const {
    isVisible,
    isCompact,
    isMobile,
    currentSection,
    isTransitioning,
    navigateToSection,
    toggleVisibility
  } = useNavigation3D({ autoHide, hideDelay })

  // Responsive sizing
  const getNavigationSize = () => {
    if (isMobile) return 'w-64 h-64'
    if (isCompact) return 'w-72 h-72'
    return 'w-80 h-80'
  }

  // Responsive positioning
  const getNavigationPosition = () => {
    if (isMobile) return 'top-2 right-2'
    return 'top-4 right-4'
  }

  return (
    <>
      {/* Navigation toggle button for mobile */}
      {isMobile && (
        <button
          onClick={toggleVisibility}
          className="fixed top-4 right-4 z-50 bg-black/50 text-white p-2 rounded-full backdrop-blur-sm border border-white/20 transition-all duration-300 hover:bg-black/70"
          aria-label="Toggle navigation menu"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      )}

      {/* 3D Navigation Menu */}
      <div className={`fixed inset-0 pointer-events-none z-40 ${className}`}>
        <div
          className={`absolute ${getNavigationPosition()} ${getNavigationSize()} pointer-events-auto transition-all duration-500 ${
            isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          } ${isTransitioning ? 'pointer-events-none' : ''}`}
        >
          <Canvas
            camera={{
              position: [0, 0, isMobile ? 4 : 5],
              fov: isMobile ? 60 : 50
            }}
            gl={{
              alpha: true,
              antialias: !isMobile, // Disable antialiasing on mobile for performance
              powerPreference: isMobile ? 'low-power' : 'high-performance'
            }}
          >
            <Navigation3DScene
              currentSection={currentSection}
              onSectionChange={navigateToSection}
              isVisible={isVisible}
              isCompact={isCompact}
              isMobile={isMobile}
            />
          </Canvas>
        </div>
      </div>
    </>
  )
}

export default Navigation3D
