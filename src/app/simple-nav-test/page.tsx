'use client'

import React from 'react'
import { SimpleNavigation3D } from '@/components/SimpleNavigation3D'
import { useCurrentSection } from '@/stores/app-store'
import { SectionType } from '@/types'

export default function SimpleNavTest() {
  const currentSection = useCurrentSection()

  const getSectionContent = () => {
    switch (currentSection) {
      case SectionType.HOME:
        return <h1 className="text-4xl font-bold text-center">🏠 Home Section</h1>
      case SectionType.RESUME:
        return <h1 className="text-4xl font-bold text-center">📄 Resume Section</h1>
      case SectionType.MATH_GALLERY:
        return <h1 className="text-4xl font-bold text-center">🔢 Math Gallery Section</h1>
      case SectionType.CODE_VISUALIZER:
        return <h1 className="text-4xl font-bold text-center">🔍 Code Visualizer Section</h1>
      case SectionType.WASM_DEMOS:
        return <h1 className="text-4xl font-bold text-center">⚡ WASM Demos Section</h1>
      case SectionType.SHADER_PLAYGROUND:
        return <h1 className="text-4xl font-bold text-center">🎨 Shader Playground Section</h1>
      default:
        return <h1 className="text-4xl font-bold text-center">Unknown Section</h1>
    }
  }

  return (
    <div className="min-h-screen bg-black text-white relative">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-green-900/20" />

      {/* Main content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen p-8">
        <div className="max-w-4xl mx-auto text-center">
          {getSectionContent()}

          <div className="mt-8 p-4 bg-white/10 rounded-lg">
            <p className="text-lg">Current Section: <span className="font-bold">{currentSection}</span></p>
            <p className="text-sm text-gray-300 mt-2">
              Click the 3D navigation items in the top-right corner to switch sections.
            </p>
            <p className="text-sm text-gray-300">
              Check browser console for click events.
            </p>
          </div>
        </div>
      </div>

      {/* Simple 3D Navigation */}
      <SimpleNavigation3D />
    </div>
  )
}
