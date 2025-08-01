'use client'

import React, { useState } from 'react'
import ShaderPlayground from '../../components/ShaderPlayground'
import { FluidSimulationShader } from '../../components/FluidSimulationShader'

type DemoType = 'playground' | 'fluid'

export default function ShaderDemoPage() {
  const [activeDemo, setActiveDemo] = useState<DemoType>('playground')

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            Shader Art Playground
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Interactive GPU-powered visual effects and shader programming demonstrations.
            Move your mouse over the canvas to interact with the shaders.
          </p>
        </div>

        <div className="max-w-6xl mx-auto">
          {/* Demo Selection */}
          <div className="mb-6">
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => setActiveDemo('playground')}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  activeDemo === 'playground'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                Basic Shaders
              </button>
              <button
                onClick={() => setActiveDemo('fluid')}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  activeDemo === 'fluid'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                Fluid Simulation
              </button>
            </div>
          </div>

          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
            {activeDemo === 'playground' && (
              <ShaderPlayground
                width={800}
                height={600}
                className="w-full"
              />
            )}

            {activeDemo === 'fluid' && (
              <FluidSimulationShader
                width={800}
                height={600}
                className="w-full"
              />
            )}
          </div>

          <div className="mt-8 bg-gray-900 rounded-lg border border-gray-800 p-6">
            <h2 className="text-2xl font-semibold text-white mb-4">Features</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium text-gray-200 mb-2">Shader Management</h3>
                <ul className="text-gray-400 space-y-1">
                  <li>• Real-time shader compilation</li>
                  <li>• Error handling and debugging</li>
                  <li>• Uniform management system</li>
                  <li>• Hot-reloading support</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-200 mb-2">Interactive Controls</h3>
                <ul className="text-gray-400 space-y-1">
                  <li>• Mouse interaction</li>
                  <li>• Real-time parameter adjustment</li>
                  <li>• Multiple shader presets</li>
                  <li>• Play/pause animation</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-200 mb-2">Fluid Simulation</h3>
                <ul className="text-gray-400 space-y-1">
                  <li>• Real-time fluid dynamics</li>
                  <li>• Mouse-interactive flow fields</li>
                  <li>• Adjustable fluid properties</li>
                  <li>• Viscosity and pressure controls</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-200 mb-2">Visual Effects</h3>
                <ul className="text-gray-400 space-y-1">
                  <li>• Fractal noise generation</li>
                  <li>• Velocity-based coloring</li>
                  <li>• Iridescent fluid effects</li>
                  <li>• Glow and tone mapping</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-8 bg-gray-900 rounded-lg border border-gray-800 p-6">
            <h2 className="text-2xl font-semibold text-white mb-4">Technical Implementation</h2>
            <div className="text-gray-300 space-y-3">
              <p>
                The Shader Art Playground demonstrates advanced WebGL programming with a
                comprehensive shader management system and real-time fluid simulation.
              </p>
              <p>
                Key technical features include:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4 text-gray-400">
                <li>Custom WebGL shader compilation and linking</li>
                <li>Efficient uniform location caching</li>
                <li>Real-time error handling and recovery</li>
                <li>Memory-efficient shader caching system</li>
                <li>Hot-reloading for development workflow</li>
                <li>Advanced fluid dynamics simulation in fragment shaders</li>
                <li>Mouse velocity tracking and interaction</li>
                <li>Fractal noise generation for realistic turbulence</li>
                <li>Real-time parameter adjustment and visual feedback</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
