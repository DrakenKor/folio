'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  initializeWASMCore,
  type WASMCoreInterface
} from '../lib/wasm-core-loader'
import type { ParticleSystemInstance } from '../types/wasm'

interface PhysicsParams {
  particleCount: number
  gravity: { x: number; y: number }
  damping: number
  restitution: number
  timeStep: number
  particleRadius: number
  particleMass: number
}

interface PerformanceMetrics {
  wasmTime: number
  jsTime: number
  speedup: number
  fps: number
  particleCount: number
}

export default function PhysicsSimulationDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const lastTimeRef = useRef<number>(0)
  const fpsCounterRef = useRef<{ frames: number; lastTime: number }>({
    frames: 0,
    lastTime: 0
  })

  const [wasmInterface, setWasmInterface] = useState<WASMCoreInterface | null>(
    null
  )
  const [particleSystem, setParticleSystem] =
    useState<ParticleSystemInstance | null>(null)
  const [jsParticleSystem, setJsParticleSystem] =
    useState<JSParticleSystem | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [useWasm, setUseWasm] = useState(true)
  const [showPerformance, setShowPerformance] = useState(false)
  const [performanceMetrics, setPerformanceMetrics] =
    useState<PerformanceMetrics | null>(null)
  const [currentFps, setCurrentFps] = useState(0)

  const [params, setParams] = useState<PhysicsParams>({
    particleCount: 50,
    gravity: { x: 0, y: 200 },
    damping: 0.99,
    restitution: 0.8,
    timeStep: 1 / 60,
    particleRadius: 8,
    particleMass: 1
  })

  // JavaScript particle system for performance comparison
  class JSParticleSystem {
    private particles: Array<{
      x: number
      y: number
      vx: number
      vy: number
      radius: number
      mass: number
      color: string
    }> = []
    private width: number
    private height: number
    private gravity = { x: 0, y: 200 }
    private damping = 0.99
    private restitution = 0.8

    constructor(width: number, height: number) {
      this.width = width
      this.height = height
    }

    addParticle(
      x: number,
      y: number,
      vx: number,
      vy: number,
      radius: number,
      mass: number
    ) {
      this.particles.push({
        x,
        y,
        vx,
        vy,
        radius,
        mass,
        color: `hsl(${Math.random() * 360}, 70%, 60%)`
      })
    }

    setGravity(x: number, y: number) {
      this.gravity.x = x
      this.gravity.y = y
    }

    setDamping(damping: number) {
      this.damping = Math.max(0, Math.min(1, damping))
    }

    setRestitution(restitution: number) {
      this.restitution = Math.max(0, Math.min(1, restitution))
    }

    update(dt: number) {
      // Apply forces and integrate
      for (const particle of this.particles) {
        particle.vx += this.gravity.x * dt
        particle.vy += this.gravity.y * dt
        particle.vx *= this.damping
        particle.vy *= this.damping
        particle.x += particle.vx * dt
        particle.y += particle.vy * dt
      }

      // Boundary collisions
      for (const particle of this.particles) {
        if (particle.x - particle.radius < 0) {
          particle.x = particle.radius
          particle.vx = -particle.vx * this.restitution
        } else if (particle.x + particle.radius > this.width) {
          particle.x = this.width - particle.radius
          particle.vx = -particle.vx * this.restitution
        }

        if (particle.y - particle.radius < 0) {
          particle.y = particle.radius
          particle.vy = -particle.vy * this.restitution
        } else if (particle.y + particle.radius > this.height) {
          particle.y = this.height - particle.radius
          particle.vy = -particle.vy * this.restitution
        }
      }

      // Particle-particle collisions
      for (let i = 0; i < this.particles.length; i++) {
        for (let j = i + 1; j < this.particles.length; j++) {
          const p1 = this.particles[i]
          const p2 = this.particles[j]

          const dx = p2.x - p1.x
          const dy = p2.y - p1.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          const minDistance = p1.radius + p2.radius

          if (distance < minDistance && distance > 0) {
            const nx = dx / distance
            const ny = dy / distance
            const overlap = minDistance - distance
            const separation = overlap * 0.5

            p1.x -= nx * separation
            p1.y -= ny * separation
            p2.x += nx * separation
            p2.y += ny * separation

            const dvx = p2.vx - p1.vx
            const dvy = p2.vy - p1.vy
            const dvn = dvx * nx + dvy * ny

            if (dvn > 0) continue

            const totalMass = p1.mass + p2.mass
            const impulse = ((2 * dvn) / totalMass) * this.restitution

            p1.vx += impulse * p2.mass * nx
            p1.vy += impulse * p2.mass * ny
            p2.vx -= impulse * p1.mass * nx
            p2.vy -= impulse * p1.mass * ny
          }
        }
      }
    }

    getParticles() {
      return this.particles
    }

    clear() {
      this.particles = []
    }

    getParticleCount() {
      return this.particles.length
    }

    setBounds(width: number, height: number) {
      this.width = width
      this.height = height
    }
  }

  // Initialize WASM module
  useEffect(() => {
    const initWasm = async () => {
      try {
        const wasmInterface = await initializeWASMCore()
        if (wasmInterface) {
          setWasmInterface(wasmInterface)
          console.log('✅ Physics WASM interface loaded')
        } else {
          console.warn('⚠️ WASM not available, using JavaScript fallback')
        }
      } catch (error) {
        console.error('❌ Failed to load WASM module:', error)
      }
    }

    initWasm()
  }, [])

  // Initialize particle systems
  const initializeSimulation = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const width = canvas.width
    const height = canvas.height

    // Initialize WASM particle system
    if (wasmInterface) {
      try {
        // Note: ParticleSystem is not yet available in WASMCoreInterface
        // This is a placeholder for when physics functionality is added
        console.log(
          'WASM interface available, but ParticleSystem not yet implemented'
        )
        setParticleSystem(null)
      } catch (error) {
        console.error('Failed to initialize WASM particle system:', error)
      }
    }

    // Initialize JavaScript particle system
    const jsSystem = new JSParticleSystem(width, height)
    jsSystem.setGravity(params.gravity.x, params.gravity.y)
    jsSystem.setDamping(params.damping)
    jsSystem.setRestitution(params.restitution)

    // Add particles
    for (let i = 0; i < params.particleCount; i++) {
      const x =
        Math.random() * (width - 2 * params.particleRadius) +
        params.particleRadius
      const y = Math.random() * (height * 0.3) + params.particleRadius
      const vx = (Math.random() - 0.5) * 100
      const vy = Math.random() * 50
      jsSystem.addParticle(
        x,
        y,
        vx,
        vy,
        params.particleRadius,
        params.particleMass
      )
    }

    setJsParticleSystem(jsSystem)
  }, [wasmInterface, params])

  // Animation loop
  const animate = useCallback(
    (currentTime: number) => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) return

      const deltaTime = (currentTime - lastTimeRef.current) / 1000
      lastTimeRef.current = currentTime

      // Update FPS counter
      fpsCounterRef.current.frames++
      if (currentTime - fpsCounterRef.current.lastTime >= 1000) {
        setCurrentFps(fpsCounterRef.current.frames)
        fpsCounterRef.current.frames = 0
        fpsCounterRef.current.lastTime = currentTime
      }

      // Clear canvas
      ctx.fillStyle = '#0a0a0a'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Update and render particles
      if (useWasm && particleSystem) {
        // WASM simulation
        particleSystem.update(deltaTime)
        const positions = particleSystem.get_positions()
        const colors = particleSystem.get_colors()

        ctx.fillStyle = '#60a5fa'
        for (let i = 0; i < positions.length; i += 2) {
          const x = positions[i]
          const y = positions[i + 1]

          ctx.beginPath()
          ctx.arc(x, y, params.particleRadius, 0, Math.PI * 2)
          ctx.fill()
        }
      } else if (!useWasm && jsParticleSystem) {
        // JavaScript simulation
        jsParticleSystem.update(deltaTime)
        const particles = jsParticleSystem.getParticles()

        for (const particle of particles) {
          ctx.fillStyle = particle.color
          ctx.beginPath()
          ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      if (isRunning) {
        animationRef.current = requestAnimationFrame(animate)
      }
    },
    [
      isRunning,
      useWasm,
      particleSystem,
      jsParticleSystem,
      params.particleRadius
    ]
  )

  // Start/stop simulation
  const toggleSimulation = () => {
    if (isRunning) {
      setIsRunning(false)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    } else {
      setIsRunning(true)
      lastTimeRef.current = performance.now()
      fpsCounterRef.current = { frames: 0, lastTime: performance.now() }
      animationRef.current = requestAnimationFrame(animate)
    }
  }

  // Reset simulation
  const resetSimulation = () => {
    setIsRunning(false)
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
    initializeSimulation()
  }

  // Performance comparison
  const runPerformanceTest = async () => {
    if (!wasmInterface || !jsParticleSystem) return

    const iterations = 1000
    const testParticleCount = 100

    // WASM performance test (using general performance test for now)
    const wasmTime = wasmInterface.performanceTest(iterations)

    // JavaScript performance test
    const jsStart = performance.now()
    const testJsSystem = new JSParticleSystem(800, 600)

    // Add test particles
    for (let i = 0; i < testParticleCount; i++) {
      const x = (i % 20) * 40 + 50
      const y = Math.floor(i / 20) * 40 + 50
      const vx = Math.sin(i * 0.1) * 50
      const vy = Math.cos(i * 0.1) * 50
      testJsSystem.addParticle(x, y, vx, vy, 5, 1)
    }

    // Run simulation
    for (let i = 0; i < iterations; i++) {
      testJsSystem.update(1 / 60)
    }

    const jsTime = performance.now() - jsStart

    const metrics: PerformanceMetrics = {
      wasmTime,
      jsTime,
      speedup: jsTime / wasmTime,
      fps: currentFps,
      particleCount: testParticleCount
    }

    setPerformanceMetrics(metrics)
    setShowPerformance(true)
  }

  // Initialize simulation when parameters change
  useEffect(() => {
    if (wasmInterface || jsParticleSystem) {
      initializeSimulation()
    }
  }, [initializeSimulation])

  // Canvas resize handler
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height

      if (particleSystem) {
        particleSystem.set_bounds(canvas.width, canvas.height)
      }
      if (jsParticleSystem) {
        jsParticleSystem.setBounds(canvas.width, canvas.height)
      }
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [particleSystem, jsParticleSystem])

  return (
    <div className="w-full max-w-6xl mx-auto p-6 bg-gray-900 rounded-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">
          Physics Simulation Demo
        </h2>
        <p className="text-gray-300">
          Interactive particle system with collision detection. Compare WASM vs
          JavaScript performance.
        </p>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Particle Count: {params.particleCount}
            </label>
            <input
              type="range"
              min="10"
              max="200"
              value={params.particleCount}
              onChange={(e) =>
                setParams((prev) => ({
                  ...prev,
                  particleCount: parseInt(e.target.value)
                }))
              }
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Gravity Y: {params.gravity.y}
            </label>
            <input
              type="range"
              min="0"
              max="500"
              value={params.gravity.y}
              onChange={(e) =>
                setParams((prev) => ({
                  ...prev,
                  gravity: { ...prev.gravity, y: parseInt(e.target.value) }
                }))
              }
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Damping: {params.damping.toFixed(3)}
            </label>
            <input
              type="range"
              min="0.9"
              max="1"
              step="0.001"
              value={params.damping}
              onChange={(e) =>
                setParams((prev) => ({
                  ...prev,
                  damping: parseFloat(e.target.value)
                }))
              }
              className="w-full"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Restitution: {params.restitution.toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={params.restitution}
              onChange={(e) =>
                setParams((prev) => ({
                  ...prev,
                  restitution: parseFloat(e.target.value)
                }))
              }
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Particle Radius: {params.particleRadius}
            </label>
            <input
              type="range"
              min="3"
              max="20"
              value={params.particleRadius}
              onChange={(e) =>
                setParams((prev) => ({
                  ...prev,
                  particleRadius: parseInt(e.target.value)
                }))
              }
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Particle Mass: {params.particleMass}
            </label>
            <input
              type="range"
              min="0.5"
              max="5"
              step="0.1"
              value={params.particleMass}
              onChange={(e) =>
                setParams((prev) => ({
                  ...prev,
                  particleMass: parseFloat(e.target.value)
                }))
              }
              className="w-full"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="useWasm"
              checked={useWasm}
              onChange={(e) => setUseWasm(e.target.checked)}
              className="rounded"
            />
            <label
              htmlFor="useWasm"
              className="text-sm font-medium text-gray-300">
              Use WASM {wasmInterface ? '✅' : '❌'}
            </label>
          </div>

          <div className="text-sm text-gray-400">
            <div>FPS: {currentFps}</div>
            <div>Engine: {useWasm ? 'WASM' : 'JavaScript'}</div>
            <div>
              Particles:{' '}
              {useWasm
                ? particleSystem?.get_particle_count() || 0
                : jsParticleSystem?.getParticleCount() || 0}
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={toggleSimulation}
              className={`w-full px-4 py-2 rounded font-medium ${
                isRunning
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}>
              {isRunning ? 'Stop' : 'Start'} Simulation
            </button>

            <button
              onClick={resetSimulation}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium">
              Reset
            </button>

            <button
              onClick={runPerformanceTest}
              disabled={!wasmInterface}
              className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded font-medium">
              Performance Test
            </button>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="w-full h-96 bg-black border border-gray-700 rounded"
          style={{ imageRendering: 'pixelated' }}
        />

        {!isRunning && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded">
            <div className="text-white text-center">
              <div className="text-xl font-bold mb-2">
                Physics Simulation Paused
              </div>
              <div className="text-sm text-gray-300">
                Click Start to begin simulation
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Performance Results */}
      {showPerformance && performanceMetrics && (
        <div className="mt-6 p-4 bg-gray-800 rounded-lg">
          <h3 className="text-lg font-bold text-white mb-3">
            Performance Comparison
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-400">WASM Time</div>
              <div className="text-white font-mono">
                {performanceMetrics.wasmTime.toFixed(2)}ms
              </div>
            </div>
            <div>
              <div className="text-gray-400">JavaScript Time</div>
              <div className="text-white font-mono">
                {performanceMetrics.jsTime.toFixed(2)}ms
              </div>
            </div>
            <div>
              <div className="text-gray-400">Speedup</div>
              <div
                className={`font-mono ${
                  performanceMetrics.speedup > 1
                    ? 'text-green-400'
                    : 'text-red-400'
                }`}>
                {performanceMetrics.speedup.toFixed(2)}x
              </div>
            </div>
            <div>
              <div className="text-gray-400">Test Particles</div>
              <div className="text-white font-mono">
                {performanceMetrics.particleCount}
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowPerformance(false)}
            className="mt-3 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm">
            Close
          </button>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 p-4 bg-gray-800 rounded-lg">
        <h3 className="text-lg font-bold text-white mb-2">Instructions</h3>
        <ul className="text-sm text-gray-300 space-y-1">
          <li>
            • Adjust particle count, gravity, damping, and restitution to see
            different behaviors
          </li>
          <li>
            • Toggle between WASM and JavaScript implementations to compare
            performance
          </li>
          <li>• Run performance tests to see quantitative speed differences</li>
          <li>
            • Higher particle counts will show more dramatic performance
            differences
          </li>
          <li>
            • WASM typically performs better with complex collision detection
          </li>
        </ul>
      </div>
    </div>
  )
}
