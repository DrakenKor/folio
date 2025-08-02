'use client'

import React, { useEffect, useState } from 'react'
import { MathGallery } from '@/components/MathGallery'
import { GalleryManager } from '@/lib/math-visualization/GalleryManager'
import { FourierVisualizer } from '@/lib/math-visualization/FourierVisualizer'
import { FractalExplorer } from '@/lib/math-visualization/FractalExplorer'
import { AlgorithmVisualizer } from '@/lib/math-visualization/AlgorithmVisualizer'
import { NeuralNetworkPlayground } from '@/lib/math-visualization/NeuralNetworkPlayground'
import { GallerySection } from '@/types/math-visualization'

// Simple test visualization for demonstration
class TestVisualization {
  id = 'test-viz'
  name = 'Test Visualization'
  description = 'A simple test visualization to verify the framework'
  category = 'fourier' as const

  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private time = 0

  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    if (!this.ctx) {
      throw new Error('Failed to get 2D context')
    }

    // Draw initial test rectangle
    this.ctx.fillStyle = '#ff0000'
    this.ctx.fillRect(10, 10, 100, 50)
    this.ctx.fillStyle = '#ffffff'
    this.ctx.font = '16px Arial'
    this.ctx.fillText('Test Canvas', 20, 35)
  }

  update(deltaTime: number): void {
    if (!this.ctx || !this.canvas) return

    this.time += deltaTime * 0.001

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    // Draw animated sine wave
    this.ctx.strokeStyle = '#3b82f6'
    this.ctx.lineWidth = 2
    this.ctx.beginPath()

    const centerY = this.canvas.height / 2 || 300
    const amplitude = Math.min(this.canvas.height / 4, 50)
    const frequency = 0.01

    for (let x = 0; x < (this.canvas.width || 800); x++) {
      const y = centerY + Math.sin(x * frequency + this.time) * amplitude
      if (x === 0) {
        this.ctx.moveTo(x, y)
      } else {
        this.ctx.lineTo(x, y)
      }
    }

    this.ctx.stroke()
  }

  handleInteraction(): void {
    // Simple interaction handling
  }

  resize(width: number, height: number): void {
    if (this.canvas) {
      this.canvas.width = width
      this.canvas.height = height
    }
  }

  cleanup(): void {
    // Cleanup resources
  }

  getControls() {
    return []
  }

  setParameter(): void {}
  getParameter(): any {}
  reset(): void {}
}

export default function MathGalleryDemoPage() {
  const [sections, setSections] = useState<GallerySection[]>([])
  const [galleryManager] = useState(() => new GalleryManager())

  useEffect(() => {
    // Register test visualization
    const testViz = new TestVisualization()
    galleryManager.registerVisualization(testViz)

    // Register Fourier visualizer
    const fourierViz = new FourierVisualizer()
    galleryManager.registerVisualization(fourierViz)

    // Register Fractal Explorer
    const fractalViz = new FractalExplorer()
    galleryManager.registerVisualization(fractalViz)

    // Register Algorithm Visualizer
    const algorithmViz = new AlgorithmVisualizer()
    galleryManager.registerVisualization(algorithmViz)

    // Register Neural Network Playground
    const neuralViz = new NeuralNetworkPlayground()
    galleryManager.registerVisualization(neuralViz)

    // Get sections with registered visualizations
    setSections(galleryManager.getSections())

    return () => {
      galleryManager.cleanup()
    }
  }, [galleryManager])

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto">
        <MathGallery sections={sections} />
      </div>
    </div>
  )
}
