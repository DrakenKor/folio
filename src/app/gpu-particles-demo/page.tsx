'use client'

import React from 'react'
import GPUParticleSystem from '../../components/GPUParticleSystem'

export default function GPUParticlesDemoPage() {
  return (
    <div className="min-h-screen bg-gray-950 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">
              GPU Particle System Demo
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Interactive GPU-accelerated particle effects with real-time parameter
              controls. Click and drag to interact with particles, adjust parameters
              to see different behaviors.
            </p>
          </div>

          <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
            <GPUParticleSystem width={800} height={600} className="w-full" />
          </div>

          <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-white">Features</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-lg mb-2 text-gray-100">
                  GPU Acceleration
                </h3>
                <ul className="list-disc list-inside space-y-1 ml-4 text-gray-300">
                  <li>WebGL shaders for high-performance rendering</li>
                  <li>Thousands of particles at 60fps</li>
                  <li>Efficient GPU memory management</li>
                  <li>Optimized vertex and fragment shaders</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2 text-gray-100">
                  Real-time Interaction
                </h3>
                <ul className="list-disc list-inside space-y-1 ml-4 text-gray-300">
                  <li>Mouse attraction forces</li>
                  <li>Dynamic particle responses</li>
                  <li>Interactive parameter controls</li>
                  <li>Live physics simulation</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2 text-gray-100">
                  Multiple Presets
                </h3>
                <ul className="list-disc list-inside space-y-1 ml-4 text-gray-300">
                  <li>Basic floating particles</li>
                  <li>Explosive fireworks effects</li>
                  <li>Galaxy spiral simulation</li>
                  <li>Fluid dynamics behavior</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2 text-gray-100">
                  Visual Effects
                </h3>
                <ul className="list-disc list-inside space-y-1 ml-4 text-gray-300">
                  <li>Multiple color modes</li>
                  <li>Life-based particle fading</li>
                  <li>HSV color transitions</li>
                  <li>Velocity-based coloring</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-white">
              Technical Implementation
            </h2>
            <div className="space-y-4 text-gray-300">
              <div>
                <h3 className="font-semibold text-lg mb-2 text-gray-100">
                  Shader System
                </h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Vertex shaders handle particle position updates and physics calculations</li>
                  <li>Fragment shaders render particles with various color modes and effects</li>
                  <li>WebGL buffers provide efficient GPU memory management for particle data</li>
                  <li>Real-time uniform updates for interactive parameter control</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2 text-gray-100">
                  Physics Simulation
                </h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Real-time physics with gravity, attraction forces, turbulence, and damping</li>
                  <li>Particle lifecycle management with automatic respawning</li>
                  <li>Life-based animations and fading effects</li>
                  <li>GPU-based calculations for smooth 60fps rendering</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2 text-gray-100">
                  Performance Optimization
                </h3>
                <p className="ml-4">
                  The entire particle system is optimized for WebGL 1.0 compatibility
                  while maintaining high performance with thousands of particles
                  rendered simultaneously at 60fps.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4 text-white">Particle Presets</h2>
            <div className="space-y-4 text-gray-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-blue-400 mb-2">
                    Basic Particles
                  </h4>
                  <p className="text-sm">
                    Simple floating particles with life-based coloring and gentle
                    physics.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-red-400 mb-2">Fireworks</h4>
                  <p className="text-sm">
                    Explosive effects with high speed, gravity, and vibrant HSV
                    colors.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-indigo-400 mb-2">
                    Galaxy Spiral
                  </h4>
                  <p className="text-sm">
                    Orbital motion with strong attraction forces and blue-white
                    gradients.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-cyan-400 mb-2">
                    Fluid Dynamics
                  </h4>
                  <p className="text-sm">
                    Fluid-like behavior with velocity-based coloring and
                    turbulence.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 bg-blue-900 border border-blue-700 rounded-lg p-6">
            <h3 className="text-blue-100 font-semibold mb-2">
              Try These Features
            </h3>
            <ul className="text-blue-200 space-y-1">
              <li>• Click and drag your mouse over the particle system to attract particles</li>
              <li>• Switch between different particle presets using the dropdown</li>
              <li>• Adjust real-time parameters with the control sliders</li>
              <li>• Experiment with different color modes and physics settings</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
