/**
 * Physics Simulation WASM Module Tests
 * Tests the particle system implementation and performance comparison
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { wasmCoreLoader } from '../lib/wasm-core-loader'
import type { WASMCoreModule, ParticleSystemInstance } from '../types/wasm'

describe('Physics Simulation WASM Module', () => {
  let wasmModule: WASMCoreModule | null = null
  let particleSystem: ParticleSystemInstance | null = null

  beforeAll(async () => {
    try {
      wasmModule = await wasmCoreLoader.loadModule()
      if (wasmModule) {
        particleSystem = new wasmModule.ParticleSystem(800, 600)
      }
    } catch (error) {
      console.warn('WASM not available for testing, skipping WASM-specific tests')
    }
  })

  afterAll(() => {
    wasmCoreLoader.dispose()
  })

  describe('ParticleSystem Creation', () => {
    it('should create a particle system with specified dimensions', () => {
      if (!wasmModule) {
        console.log('Skipping WASM test - module not available')
        return
      }

      const system = new wasmModule.ParticleSystem(400, 300)
      expect(system).toBeDefined()
      expect(system.get_particle_count()).toBe(0)

      const bounds = system.get_bounds()
      expect(bounds[0]).toBe(0) // min x
      expect(bounds[1]).toBe(0) // min y
      expect(bounds[2]).toBe(400) // max x
      expect(bounds[3]).toBe(300) // max y
    })

    it('should allow bounds modification', () => {
      if (!particleSystem) {
        console.log('Skipping WASM test - particle system not available')
        return
      }

      particleSystem.set_bounds(1000, 800)
      const bounds = particleSystem.get_bounds()
      expect(bounds[2]).toBe(1000)
      expect(bounds[3]).toBe(800)
    })
  })

  describe('Particle Management', () => {
    beforeAll(() => {
      if (particleSystem) {
        particleSystem.clear_particles()
      }
    })

    it('should add particles to the system', () => {
      if (!particleSystem) {
        console.log('Skipping WASM test - particle system not available')
        return
      }

      const initialCount = particleSystem.get_particle_count()
      const particleId = particleSystem.add_particle(100, 100, 10, -5, 8, 1.5)

      expect(particleId).toBe(initialCount)
      expect(particleSystem.get_particle_count()).toBe(initialCount + 1)
    })

    it('should retrieve particle positions and velocities', () => {
      if (!particleSystem) {
        console.log('Skipping WASM test - particle system not available')
        return
      }

      particleSystem.clear_particles()
      particleSystem.add_particle(50, 75, 20, -10, 5, 1)
      particleSystem.add_particle(150, 125, -15, 5, 7, 2)

      const positions = particleSystem.get_positions()
      const velocities = particleSystem.get_velocities()

      expect(positions.length).toBe(4) // 2 particles * 2 coordinates
      expect(velocities.length).toBe(4) // 2 particles * 2 velocities

      expect(positions[0]).toBe(50)  // first particle x
      expect(positions[1]).toBe(75)  // first particle y
      expect(positions[2]).toBe(150) // second particle x
      expect(positions[3]).toBe(125) // second particle y

      expect(velocities[0]).toBe(20)  // first particle vx
      expect(velocities[1]).toBe(-10) // first particle vy
      expect(velocities[2]).toBe(-15) // second particle vx
      expect(velocities[3]).toBe(5)   // second particle vy
    })

    it('should get comprehensive particle data', () => {
      if (!particleSystem) {
        console.log('Skipping WASM test - particle system not available')
        return
      }

      particleSystem.clear_particles()
      particleSystem.add_particle(100, 200, 30, -20, 10, 2.5)

      const data = particleSystem.get_particle_data()
      expect(data.length).toBe(6) // x, y, vx, vy, radius, mass

      expect(data[0]).toBe(100)  // x
      expect(data[1]).toBe(200)  // y
      expect(data[2]).toBe(30)   // vx
      expect(data[3]).toBe(-20)  // vy
      expect(data[4]).toBe(10)   // radius
      expect(data[5]).toBe(2.5)  // mass
    })
  })

  describe('Physics Parameters', () => {
    it('should set and apply gravity', () => {
      if (!particleSystem) {
        console.log('Skipping WASM test - particle system not available')
        return
      }

      particleSystem.clear_particles()
      particleSystem.set_gravity(50, 100)
      particleSystem.add_particle(400, 100, 0, 0, 5, 1)

      const initialVelocities = particleSystem.get_velocities()
      expect(initialVelocities[0]).toBe(0) // initial vx
      expect(initialVelocities[1]).toBe(0) // initial vy

      // Update simulation to apply gravity
      particleSystem.update(0.1) // 0.1 second

      const updatedVelocities = particleSystem.get_velocities()
      expect(updatedVelocities[0]).toBeCloseTo(5, 1) // gravity x * dt
      expect(updatedVelocities[1]).toBeCloseTo(10, 1) // gravity y * dt
    })

    it('should apply damping to velocities', () => {
      if (!particleSystem) {
        console.log('Skipping WASM test - particle system not available')
        return
      }

      particleSystem.clear_particles()
      particleSystem.set_gravity(0, 0) // No gravity
      particleSystem.set_damping(0.9) // 10% velocity loss per frame
      particleSystem.add_particle(400, 300, 100, 0, 5, 1)

      const initialVelocities = particleSystem.get_velocities()
      expect(initialVelocities[0]).toBe(100)

      particleSystem.update(1/60) // One frame
      const dampedVelocities = particleSystem.get_velocities()
      expect(dampedVelocities[0]).toBeCloseTo(90, 1) // 100 * 0.9
    })

    it('should configure restitution for collisions', () => {
      if (!particleSystem) {
        console.log('Skipping WASM test - particle system not available')
        return
      }

      particleSystem.set_restitution(0.5) // 50% energy retention
      // Note: Testing actual collision behavior would require more complex setup
      // This test just verifies the parameter can be set without error
      expect(() => particleSystem.set_restitution(0.8)).not.toThrow()
    })

    it('should set custom time step', () => {
      if (!particleSystem) {
        console.log('Skipping WASM test - particle system not available')
        return
      }

      expect(() => particleSystem.set_time_step(1/120)).not.toThrow() // 120 FPS
      expect(() => particleSystem.set_time_step(1/30)).not.toThrow()  // 30 FPS
    })
  })

  describe('Simulation Updates', () => {
    it('should update particle positions based on velocity', () => {
      if (!particleSystem) {
        console.log('Skipping WASM test - particle system not available')
        return
      }

      particleSystem.clear_particles()
      particleSystem.set_gravity(0, 0) // No gravity for predictable movement
      particleSystem.set_damping(1.0) // No damping
      particleSystem.add_particle(100, 100, 60, 0, 5, 1) // 60 pixels/second rightward

      const initialPositions = particleSystem.get_positions()
      expect(initialPositions[0]).toBe(100)

      particleSystem.update(1.0) // 1 second
      const updatedPositions = particleSystem.get_positions()
      expect(updatedPositions[0]).toBeCloseTo(160, 1) // 100 + 60*1
    })

    it('should handle boundary collisions', () => {
      if (!particleSystem) {
        console.log('Skipping WASM test - particle system not available')
        return
      }

      particleSystem.clear_particles()
      particleSystem.set_bounds(200, 200)
      particleSystem.set_gravity(0, 0)
      particleSystem.set_damping(1.0)
      particleSystem.set_restitution(1.0) // Perfect elastic collision

      // Add particle near right boundary moving right
      particleSystem.add_particle(190, 100, 100, 0, 5, 1)

      particleSystem.update(0.1) // Should hit boundary and bounce

      const positions = particleSystem.get_positions()
      const velocities = particleSystem.get_velocities()

      // Particle should be at boundary and velocity should be reversed
      expect(positions[0]).toBeLessThanOrEqual(195) // Within boundary
      expect(velocities[0]).toBeLessThan(0) // Velocity reversed
    })
  })

  describe('Particle Manipulation', () => {
    it('should allow direct position modification', () => {
      if (!particleSystem) {
        console.log('Skipping WASM test - particle system not available')
        return
      }

      particleSystem.clear_particles()
      const particleId = particleSystem.add_particle(100, 100, 0, 0, 5, 1)

      particleSystem.set_particle_position(particleId, 250, 300)
      const positions = particleSystem.get_positions()
      expect(positions[0]).toBe(250)
      expect(positions[1]).toBe(300)
    })

    it('should allow direct velocity modification', () => {
      if (!particleSystem) {
        console.log('Skipping WASM test - particle system not available')
        return
      }

      particleSystem.clear_particles()
      const particleId = particleSystem.add_particle(100, 100, 10, 20, 5, 1)

      particleSystem.set_particle_velocity(particleId, -30, 40)
      const velocities = particleSystem.get_velocities()
      expect(velocities[0]).toBe(-30)
      expect(velocities[1]).toBe(40)
    })

    it('should apply forces to individual particles', () => {
      if (!particleSystem) {
        console.log('Skipping WASM test - particle system not available')
        return
      }

      particleSystem.clear_particles()
      particleSystem.set_gravity(0, 0)
      const particleId = particleSystem.add_particle(100, 100, 0, 0, 5, 2) // mass = 2

      const initialVelocities = particleSystem.get_velocities()
      expect(initialVelocities[0]).toBe(0)

      // Apply force: F = ma, so a = F/m = 20/2 = 10
      particleSystem.add_force_to_particle(particleId, 20, 0)

      const velocities = particleSystem.get_velocities()
      // Force is applied as impulse, so velocity change depends on time step
      expect(velocities[0]).toBeGreaterThan(0)
    })
  })

  describe('Energy and Metrics', () => {
    it('should calculate total kinetic energy', () => {
      if (!particleSystem) {
        console.log('Skipping WASM test - particle system not available')
        return
      }

      particleSystem.clear_particles()
      // KE = 0.5 * m * v^2
      // Particle 1: 0.5 * 1 * (10^2 + 0^2) = 50
      // Particle 2: 0.5 * 2 * (0^2 + 20^2) = 400
      // Total: 450
      particleSystem.add_particle(100, 100, 10, 0, 5, 1)
      particleSystem.add_particle(200, 200, 0, 20, 5, 2)

      const kineticEnergy = particleSystem.get_kinetic_energy()
      expect(kineticEnergy).toBeCloseTo(450, 1)
    })

    it('should clear all particles', () => {
      if (!particleSystem) {
        console.log('Skipping WASM test - particle system not available')
        return
      }

      particleSystem.add_particle(100, 100, 0, 0, 5, 1)
      particleSystem.add_particle(200, 200, 0, 0, 5, 1)
      expect(particleSystem.get_particle_count()).toBe(2)

      particleSystem.clear_particles()
      expect(particleSystem.get_particle_count()).toBe(0)
      expect(particleSystem.get_kinetic_energy()).toBe(0)
    })
  })

  describe('Performance Testing', () => {
    it('should run physics performance benchmark', () => {
      if (!wasmModule) {
        console.log('Skipping WASM test - module not available')
        return
      }

      const particleCount = 50
      const iterations = 100

      const executionTime = wasmModule.physics_performance_test(particleCount, iterations)

      expect(executionTime).toBeGreaterThan(0)
      expect(executionTime).toBeLessThan(5000) // Should complete within 5 seconds

      console.log(`Physics performance test: ${particleCount} particles, ${iterations} iterations in ${executionTime.toFixed(2)}ms`)
    })

    it('should handle large particle counts efficiently', () => {
      if (!wasmModule) {
        console.log('Skipping WASM test - module not available')
        return
      }

      const system = new wasmModule.ParticleSystem(1000, 1000)
      const particleCount = 200

      const startTime = performance.now()

      // Add many particles
      for (let i = 0; i < particleCount; i++) {
        system.add_particle(
          Math.random() * 900 + 50,
          Math.random() * 900 + 50,
          (Math.random() - 0.5) * 100,
          (Math.random() - 0.5) * 100,
          5,
          1
        )
      }

      // Run several simulation steps
      for (let i = 0; i < 60; i++) {
        system.update(1/60)
      }

      const endTime = performance.now()
      const executionTime = endTime - startTime

      expect(system.get_particle_count()).toBe(particleCount)
      expect(executionTime).toBeLessThan(1000) // Should complete within 1 second

      console.log(`Large simulation test: ${particleCount} particles, 60 frames in ${executionTime.toFixed(2)}ms`)
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid particle indices gracefully', () => {
      if (!particleSystem) {
        console.log('Skipping WASM test - particle system not available')
        return
      }

      particleSystem.clear_particles()

      // These operations should not crash with invalid indices
      expect(() => particleSystem.set_particle_position(999, 100, 100)).not.toThrow()
      expect(() => particleSystem.set_particle_velocity(999, 10, 10)).not.toThrow()
      expect(() => particleSystem.add_force_to_particle(999, 10, 10)).not.toThrow()
    })

    it('should handle extreme parameter values', () => {
      if (!particleSystem) {
        console.log('Skipping WASM test - particle system not available')
        return
      }

      // These should be clamped or handled gracefully
      expect(() => particleSystem.set_damping(-1)).not.toThrow()
      expect(() => particleSystem.set_damping(2)).not.toThrow()
      expect(() => particleSystem.set_restitution(-0.5)).not.toThrow()
      expect(() => particleSystem.set_restitution(1.5)).not.toThrow()
      expect(() => particleSystem.set_time_step(0)).not.toThrow()
      expect(() => particleSystem.set_time_step(1)).not.toThrow()
    })
  })
})

// JavaScript implementation for comparison testing
class JSParticleSystem {
  private particles: Array<{
    x: number; y: number; vx: number; vy: number;
    radius: number; mass: number;
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

  addParticle(x: number, y: number, vx: number, vy: number, radius: number, mass: number) {
    this.particles.push({ x, y, vx, vy, radius, mass })
    return this.particles.length - 1
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

    // Particle-particle collisions (simplified)
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
          const impulse = 2 * dvn / totalMass * this.restitution

          p1.vx += impulse * p2.mass * nx
          p1.vy += impulse * p2.mass * ny
          p2.vx -= impulse * p1.mass * nx
          p2.vy -= impulse * p1.mass * ny
        }
      }
    }
  }

  getParticleCount() {
    return this.particles.length
  }

  clear() {
    this.particles = []
  }
}

describe('Performance Comparison', () => {
  let testWasmModule: WASMCoreModule | null = null

  beforeAll(async () => {
    try {
      testWasmModule = await wasmCoreLoader.loadModule()
    } catch (error) {
      console.warn('WASM not available for performance testing')
    }
  })

  it('should compare WASM vs JavaScript performance', async () => {
    if (!testWasmModule) {
      console.log('Skipping performance comparison - WASM not available')
      return
    }

    const particleCount = 100
    const iterations = 500
    const width = 800
    const height = 600

    // WASM performance test
    const wasmTime = testWasmModule.physics_performance_test(particleCount, iterations)

    // JavaScript performance test
    const jsSystem = new JSParticleSystem(width, height)

    // Add particles
    for (let i = 0; i < particleCount; i++) {
      const x = (i % 20) * 40 + 50
      const y = Math.floor(i / 20) * 40 + 50
      const vx = Math.sin(i * 0.1) * 50
      const vy = Math.cos(i * 0.1) * 50
      jsSystem.addParticle(x, y, vx, vy, 5, 1)
    }

    const jsStart = performance.now()
    for (let i = 0; i < iterations; i++) {
      jsSystem.update(1/60)
    }
    const jsTime = performance.now() - jsStart

    const speedup = jsTime / wasmTime

    console.log(`Performance Comparison:`)
    console.log(`  WASM: ${wasmTime.toFixed(2)}ms`)
    console.log(`  JavaScript: ${jsTime.toFixed(2)}ms`)
    console.log(`  Speedup: ${speedup.toFixed(2)}x`)

    expect(wasmTime).toBeGreaterThan(0)
    expect(jsTime).toBeGreaterThan(0)
    // WASM should generally be faster, but allow for some variance
    expect(speedup).toBeGreaterThan(0.5) // At least not significantly slower
  })
})
