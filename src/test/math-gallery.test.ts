import { describe, expect, it, vi } from 'vitest'
import { ALGORITHMS, AlgorithmVisualizer, applyStep, makeInput, sortSteps } from '../lib/math-visualization/AlgorithmVisualizer'
import { FourierVisualizer, reconstruct, transform } from '../lib/math-visualization/FourierVisualizer'
import { FractalExplorer } from '../lib/math-visualization/FractalExplorer'
import { GalleryManager } from '../lib/math-visualization/GalleryManager'
import { Network, NeuralNetworkPlayground, makeData, sampleGrid, score, trainSteps } from '../lib/math-visualization/NeuralNetworkPlayground'
import { mulberry32 } from '../lib/math-visualization/tokens'
import { GalleryHost } from '../types/math-visualization'

describe('Math gallery', () => {
  it('initialises each exhibit once and cleans up the one left', async () => {
    const manager = new GalleryManager()
    const exhibits = [new FractalExplorer(), new FourierVisualizer(), new AlgorithmVisualizer(), new NeuralNetworkPlayground()]
    const spies = exhibits.map(exhibit => {
      manager.registerVisualization(exhibit)
      return {
        initialize: vi.spyOn(exhibit, 'initialize').mockResolvedValue(),
        cleanup: vi.spyOn(exhibit, 'cleanup').mockImplementation(() => {})
      }
    })
    const host = { canvases: {} } as GalleryHost

    for (const exhibit of exhibits) {
      expect(await manager.activate(exhibit.id, host)).toBe(exhibit)
      expect(manager.active).toBe(exhibit)
    }

    expect(spies.map(spy => spy.initialize.mock.calls.length)).toEqual([1, 1, 1, 1])
    // Every exhibit that was left was cleaned up; the one on stage was not
    expect(spies.map(spy => spy.cleanup.mock.calls.length)).toEqual([1, 1, 1, 0])
  })

  it('sorts a fixed array of 50 with each of the six algorithms by replaying its steps', () => {
    const input = makeInput('random', 50, mulberry32(7))
    const sorted = [...input].sort((a, b) => a - b)
    expect(ALGORITHMS).toHaveLength(6)
    for (const { id } of ALGORITHMS) {
      const values = [...input]
      for (const step of sortSteps(id, input)) applyStep(values, step)
      expect(values, id).toEqual(sorted)
    }
  })

  it('finds one dominant term in a sampled circle and rebuilds it within a pixel', () => {
    const circle = Array.from({ length: 512 }, (_, n) => {
      const angle = (2 * Math.PI * n) / 512
      return { x: 300 + 120 * Math.cos(angle), y: 200 + 120 * Math.sin(angle) }
    })
    const { centre, terms } = transform(circle)

    expect(terms[0].frequency).toBe(1)
    expect(terms[0].amplitude).toBeCloseTo(120, 6)
    expect(terms[1].amplitude).toBeLessThan(1e-6)

    const rebuilt = reconstruct(centre, terms, terms.length, circle.length)
    const worst = Math.max(...rebuilt.map((point, n) => Math.hypot(point.x - circle[n].x, point.y - circle[n].y)))
    expect(worst).toBeLessThan(1)
  })

  it('brings the loss on XOR under 0.05 in 2,000 steps with a fixed seed, moving the boundary', () => {
    const random = mulberry32(1)
    const data = makeData('xor', random)
    const network = new Network([2, 8, 8, 1], 'tanh', random)
    const plane = { left: -1.2, top: -1.2, right: 1.2, bottom: 1.2 }
    const before = sampleGrid(network, 96, plane)

    trainSteps(network, data, 0.03, 2000, random)

    expect(score(network, data).loss).toBeLessThan(0.05)
    const after = sampleGrid(network, 96, plane)
    expect(after.some((value, i) => Math.abs(value - before[i]) > 0.25)).toBe(true)
  })
})
