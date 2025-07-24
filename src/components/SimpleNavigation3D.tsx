'use client'

import React, { useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { SectionType } from '@/types'
import { useCurrentSection, useAppStore } from '@/stores/app-store'

interface SimpleNavItemProps {
  position: [number, number, number]
  color: string
  label: string
  section: SectionType
  isActive: boolean
  onClick: (section: SectionType) => void
}

function SimpleNavItem({ position, color, label, section, isActive, onClick }: SimpleNavItemProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.5
      const scale = hovered || isActive ? 1.2 : 1.0
      meshRef.current.scale.setScalar(scale)
    }
  })

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={() => onClick(section)}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isActive ? 0.3 : hovered ? 0.2 : 0.1}
        />
      </mesh>
      <Text
        position={[0, -0.8, 0]}
        fontSize={0.2}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  )
}

function CentralLogo({ onClick }: { onClick: () => void }) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.3
    }
  })

  return (
    <mesh ref={meshRef} onClick={onClick}>
      <icosahedronGeometry args={[0.8, 1]} />
      <meshStandardMaterial color="white" wireframe />
    </mesh>
  )
}

export function SimpleNavigation3D() {
  const currentSection = useCurrentSection()
  const { setCurrentSection } = useAppStore()

  const navItems = [
    { section: SectionType.HOME, label: 'Home', color: '#ffffff', position: [0, 2, 0] as [number, number, number] },
    { section: SectionType.RESUME, label: 'Resume', color: '#60a5fa', position: [2, 1, 0] as [number, number, number] },
    { section: SectionType.MATH_GALLERY, label: 'Math', color: '#34d399', position: [1.5, -1.5, 0] as [number, number, number] },
    { section: SectionType.CODE_VISUALIZER, label: 'Code', color: '#f59e0b', position: [-1.5, -1.5, 0] as [number, number, number] },
    { section: SectionType.WASM_DEMOS, label: 'WASM', color: '#ef4444', position: [-2, 1, 0] as [number, number, number] },
    { section: SectionType.SHADER_PLAYGROUND, label: 'Shaders', color: '#a855f7', position: [0, -2.5, 0] as [number, number, number] }
  ]

  const handleNavClick = (section: SectionType) => {
    console.log('Navigation clicked:', section)
    console.log('Current section before:', currentSection)
    setCurrentSection(section)
    console.log('Current section after:', section)
  }

  const handleLogoClick = () => {
    console.log('Logo clicked')
    setCurrentSection(SectionType.HOME)
  }

  return (
    <div className="fixed top-4 right-4 w-96 h-96 border border-white/20 bg-black/20 backdrop-blur-sm rounded-lg">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 50 }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={0.8} />
        <pointLight position={[-10, -10, -10]} intensity={0.4} color="#4f46e5" />

        <CentralLogo onClick={handleLogoClick} />

        {navItems.map((item) => (
          <SimpleNavItem
            key={item.section}
            position={item.position}
            color={item.color}
            label={item.label}
            section={item.section}
            isActive={currentSection === item.section}
            onClick={handleNavClick}
          />
        ))}
      </Canvas>
    </div>
  )
}
