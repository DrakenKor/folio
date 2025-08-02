'use client'

import React, { useState } from 'react'
import ShaderPlayground from '../../components/ShaderPlayground'
import { FluidSimulationShader } from '../../components/FluidSimulationShader'
import RaymarchingRenderer from '../../components/RaymarchingRenderer'

type DemoType = 'playground' | 'fluid' | 'raymarching'

export default function ShaderDemoPage() {
  const [activeDemo, setActiveDemo] = useState<DemoType>('playground')

  return (
    <div className="min-h-screen bg-gray-950 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">
              Shader Art Playground Demo
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Interactive GPU-powered visual effects and shader programming demonstrations.
              Move your mouse over the canvas to interact with the shaders.
            </p>
          </div>

          {/* Demo Selection */}
          <div className="mb-6">
            <div className="flex justify-center space-x-4 flex-wrap gap-2">
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
              <button
                onClick={() => setActiveDemo('raymarching')}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  activeDemo === 'raymarching'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                Raymarching Scenes
              </button>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
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

            {activeDemo === 'raymarching' && (
              <RaymarchingRenderer
                width={800}
                height={600}
                className="w-full"
              />
            )}
          </div>

          <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-white">Features</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-lg mb-2 text-gray-100">Shader Management</h3>
                <ul className="list-disc list-inside space-y-1 ml-4 text-gray-300">
                  <li>Real-time shader compilation</li>
                  <li>Error handling and debugging</li>
                  <li>Uniform management system</li>
                  <li>Hot-reloading support</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2 text-gray-100">Interactive Controls</h3>
                <ul className="list-disc list-inside space-y-1 ml-4 text-gray-300">
                  <li>Mouse interaction</li>
                  <li>Real-time parameter adjustment</li>
                  <li>Multiple shader presets</li>
                  <li>Play/pause animation</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2 text-gray-100">Fluid Simulation</h3>
                <ul className="list-disc list-inside space-y-1 ml-4 text-gray-300">
                  <li>Real-time fluid dynamics</li>
                  <li>Mouse-interactive flow fields</li>
                  <li>Adjustable fluid properties</li>
                  <li>Viscosity and pressure controls</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2 text-gray-100">Visual Effects</h3>
                <ul className="list-disc list-inside space-y-1 ml-4 text-gray-300">
                  <li>Fractal noise generation</li>
                  <li>Velocity-based coloring</li>
                  <li>Iridescent fluid effects</li>
                  <li>Glow and tone mapping</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2 text-gray-100">Raymarching Scenes</h3>
                <ul className="list-disc list-inside space-y-1 ml-4 text-gray-300">
                  <li>3D scene rendering in fragment shaders</li>
                  <li>Interactive camera controls</li>
                  <li>Multiple scene environments</li>
                  <li>Real-time fractal generation</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4 text-white">Technical Implementation</h2>
            <div className="space-y-4 text-gray-300">
              <p>
                The Shader Art Playground demonstrates advanced WebGL programming with a
                comprehensive shader management system, real-time fluid simulation, and
                3D raymarching scene rendering.
              </p>
              <div>
                <h3 className="font-semibold text-lg mb-2 text-gray-100">
                  Core Features
                </h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Custom WebGL shader compilation and linking</li>
                  <li>Efficient uniform location caching</li>
                  <li>Real-time error handling and recovery</li>
                  <li>Memory-efficient shader caching system</li>
                  <li>Hot-reloading for development workflow</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2 text-gray-100">
                  Advanced Techniques
                </h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Advanced fluid dynamics simulation in fragment shaders</li>
                  <li>Mouse velocity tracking and interaction</li>
                  <li>Fractal noise generation for realistic turbulence</li>
                  <li>3D raymarching with signed distance functions</li>
                  <li>Interactive camera controls with orbit and zoom</li>
                  <li>Multiple scene presets with different environments</li>
                  <li>Real-time fractal rendering (Mandelbulb, geometric scenes)</li>
                  <li>Advanced lighting and material systems in shaders</li>
                  <li>Real-time parameter adjustment and visual feedback</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-8 bg-blue-900 border border-blue-700 rounded-lg p-6">
            <h3 className="text-blue-100 font-semibold mb-2">
              Try These Features
            </h3>
            <ul className="text-blue-200 space-y-1">
              <li>• Switch between different shader experiences using the tabs above</li>
              <li>• Move your mouse over the canvas to interact with the shaders</li>
              <li>• Adjust parameters in real-time to see immediate visual changes</li>
              <li>• Try different presets to explore various visual effects</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
