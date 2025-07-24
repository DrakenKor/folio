'use client'

import React from 'react'
import { Navigation3D } from '@/components/Navigation3D'
import { useCurrentSection } from '@/stores/app-store'
import { SectionType } from '@/types'

export default function NavigationDemo() {
  const currentSection = useCurrentSection()

  const getSectionContent = () => {
    switch (currentSection) {
      case SectionType.HOME:
        return (
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">Welcome Home</h1>
            <p className="text-lg text-gray-300">This is the home section of the portfolio.</p>
          </div>
        )
      case SectionType.RESUME:
        return (
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">3D Resume Timeline</h1>
            <p className="text-lg text-gray-300">Interactive 3D timeline of work experience.</p>
          </div>
        )
      case SectionType.MATH_GALLERY:
        return (
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">Mathematical Art Gallery</h1>
            <p className="text-lg text-gray-300">Interactive mathematical visualizations.</p>
          </div>
        )
      case SectionType.CODE_VISUALIZER:
        return (
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">Code Architecture Visualizer</h1>
            <p className="text-lg text-gray-300">3D visualization of code architecture.</p>
          </div>
        )
      case SectionType.WASM_DEMOS:
        return (
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">WASM Performance Demos</h1>
            <p className="text-lg text-gray-300">High-performance WebAssembly demonstrations.</p>
          </div>
        )
      case SectionType.SHADER_PLAYGROUND:
        return (
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">Shader Art Playground</h1>
            <p className="text-lg text-gray-300">GPU-accelerated visual effects and shaders.</p>
          </div>
        )
      default:
        return (
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">Portfolio Section</h1>
            <p className="text-lg text-gray-300">Navigate using the 3D menu.</p>
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-green-900/20" />

      {/* Main content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen p-8">
        <div className="max-w-4xl mx-auto">
          {getSectionContent()}

          {/* Instructions */}
          <div className="mt-12 p-6 bg-white/5 rounded-lg backdrop-blur-sm border border-white/10">
            <h3 className="text-xl font-semibold mb-4">Navigation Instructions</h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-300">
              <div>
                <h4 className="font-medium text-white mb-2">Mouse/Touch:</h4>
                <ul className="space-y-1">
                  <li>• Click navigation items to switch sections</li>
                  <li>• Hover for enhanced visual effects</li>
                  <li>• Mobile: Tap menu button to toggle</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-white mb-2">Keyboard:</h4>
                <ul className="space-y-1">
                  <li>• Arrow keys to navigate</li>
                  <li>• Enter to select current section</li>
                  <li>• Number keys 1-6 for direct access</li>
                  <li>• Escape to close (mobile)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3D Navigation Menu */}
      <Navigation3D />
    </div>
  )
}
