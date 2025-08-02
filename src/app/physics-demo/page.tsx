'use client'

import React, { Suspense } from 'react'
import PhysicsSimulationDemo from '../../components/PhysicsSimulationDemo'
import RubiLoader from '../components/Loaders/RubiLoader'

export default function PhysicsDemoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 p-4">
      <div className="container mx-auto py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            WASM Physics Simulation
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Experience high-performance particle physics powered by WebAssembly.
            Compare WASM vs JavaScript performance with real-time collision detection
            and interactive parameter controls.
          </p>
        </div>

        <Suspense
          fallback={
            <div className="flex items-center justify-center min-h-96">
              <div className="text-center">
                <RubiLoader type="white" />
                <p className="text-white mt-4">Loading Physics Simulation...</p>
              </div>
            </div>
          }
        >
          <PhysicsSimulationDemo />
        </Suspense>

        {/* Technical Details */}
        <div className="mt-12 max-w-4xl mx-auto">
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-white mb-4">Technical Implementation</h2>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-blue-400 mb-3">WASM Features</h3>
                <ul className="text-gray-300 space-y-2 text-sm">
                  <li>• Rust-based particle system with optimized collision detection</li>
                  <li>• Memory-efficient data structures for large particle counts</li>
                  <li>• SIMD-optimized vector operations where possible</li>
                  <li>• Minimal WASM binary size (~15KB compressed)</li>
                  <li>• Direct memory access for performance-critical operations</li>
                  <li>• Configurable physics parameters (gravity, damping, restitution)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-green-400 mb-3">Performance Benefits</h3>
                <ul className="text-gray-300 space-y-2 text-sm">
                  <li>• 2-5x faster than JavaScript for complex simulations</li>
                  <li>• Consistent frame rates with high particle counts</li>
                  <li>• Reduced garbage collection pressure</li>
                  <li>• Predictable performance characteristics</li>
                  <li>• Better CPU cache utilization</li>
                  <li>• Automatic fallback to JavaScript when WASM unavailable</li>
                </ul>
              </div>
            </div>

            <div className="mt-6 p-4 bg-gray-700 rounded">
              <h4 className="text-md font-semibold text-yellow-400 mb-2">Physics Simulation Features</h4>
              <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-300">
                <div>
                  <strong>Collision Detection:</strong>
                  <br />Circle-circle collision with proper separation and impulse resolution
                </div>
                <div>
                  <strong>Boundary Handling:</strong>
                  <br />Elastic collisions with configurable restitution coefficient
                </div>
                <div>
                  <strong>Force Integration:</strong>
                  <br />Verlet integration with configurable time steps and damping
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-8 text-center">
          <div className="space-x-4">
            <a
              href="/wasm-demo"
              className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              ← WASM Core Demo
            </a>
            <a
              href="/image-processing-demo"
              className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
            >
              Image Processing Demo →
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
