'use client'

import React, { useRef, useEffect, useState } from 'react'
import { MathVisualization, InteractionEvent, VisualizationState } from '@/types/math-visualization'

interface VisualizationCanvasProps {
  visualization: MathVisualization
  state: VisualizationState
  onStateUpdate: (updates: Partial<VisualizationState>) => void
  width?: number
  height?: number
}

export const VisualizationCanvas: React.FC<VisualizationCanvasProps> = ({
  visualization,
  state,
  onStateUpdate,
  width = 800,
  height = 600
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number>()
  const lastTimeRef = useRef<number>(0)
  const [isMouseDown, setIsMouseDown] = useState(false)
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 })

  // Initialize visualization
  useEffect(() => {
    const initializeVisualization = async () => {
      if (!canvasRef.current) return

      onStateUpdate({ isLoading: true, error: undefined })

      try {
        // Set initial canvas size
        const canvas = canvasRef.current
        canvas.width = width
        canvas.height = height

        await visualization.initialize(canvas)
        onStateUpdate({ isActive: true, isLoading: false })
        startAnimationLoop()
      } catch (error) {
        console.error('Failed to initialize visualization:', error)
        onStateUpdate({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to initialize'
        })
      }
    }

    // Clean up previous instance
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }

    initializeVisualization()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      visualization.cleanup()
    }
  }, [visualization, width, height])

  // Handle canvas resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && containerRef.current) {
        const container = containerRef.current
        const rect = container.getBoundingClientRect()
        const newWidth = Math.max(400, rect.width - 8) // Account for padding
        const newHeight = Math.max(300, rect.height - 60) // Account for header

        canvasRef.current.width = newWidth
        canvasRef.current.height = newHeight

        visualization.resize(newWidth, newHeight)
      }
    }

    // Use setTimeout to ensure container is rendered
    const timeoutId = setTimeout(handleResize, 100)

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(timeoutId)
    }
  }, [visualization])

  const startAnimationLoop = () => {
    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastTimeRef.current
      lastTimeRef.current = currentTime

      if (state.isActive) {
        visualization.update(deltaTime)
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)
  }

  const getMousePosition = (event: React.MouseEvent): { x: number; y: number } => {
    if (!canvasRef.current) return { x: 0, y: 0 }

    const rect = canvasRef.current.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    }
  }

  const handleMouseDown = (event: React.MouseEvent) => {
    setIsMouseDown(true)
    const pos = getMousePosition(event)
    setLastMousePos(pos)

    const interactionEvent: InteractionEvent = {
      type: 'mouse',
      position: pos,
      key: event.ctrlKey ? 'Control' : event.metaKey ? 'Meta' : undefined
    }

    visualization.handleInteraction(interactionEvent)
  }

  const handleMouseMove = (event: React.MouseEvent) => {
    const pos = getMousePosition(event)

    const interactionEvent: InteractionEvent = {
      type: 'mouse',
      position: pos,
      delta: isMouseDown ? {
        x: pos.x - lastMousePos.x,
        y: pos.y - lastMousePos.y
      } : undefined,
      key: event.ctrlKey ? 'Control' : event.metaKey ? 'Meta' : undefined
    }

    visualization.handleInteraction(interactionEvent)
    setLastMousePos(pos)
  }

  const handleMouseUp = () => {
    setIsMouseDown(false)
  }

  const handleTouchStart = (event: React.TouchEvent) => {
    event.preventDefault()
    const touch = event.touches[0]
    if (!canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const pos = {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    }

    const interactionEvent: InteractionEvent = {
      type: 'touch',
      position: pos,
      pressure: (touch as any).force || 1
    }

    visualization.handleInteraction(interactionEvent)
  }

  const handleTouchMove = (event: React.TouchEvent) => {
    event.preventDefault()
    const touch = event.touches[0]
    if (!canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const pos = {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    }

    const interactionEvent: InteractionEvent = {
      type: 'touch',
      position: pos,
      pressure: (touch as any).force || 1
    }

    visualization.handleInteraction(interactionEvent)
  }

  const handleWheel = (event: React.WheelEvent) => {
    event.preventDefault()
    const pos = getMousePosition(event as any)

    const interactionEvent: InteractionEvent = {
      type: 'wheel',
      position: pos,
      wheelDelta: -event.deltaY // Invert for natural scrolling
    }

    visualization.handleInteraction(interactionEvent)
  }

  if (state.error) {
    return (
      <div className="visualization-error bg-red-900 border border-red-700 rounded-lg p-6 text-center">
        <h3 className="text-red-300 font-semibold mb-2">Visualization Error</h3>
        <p className="text-red-200">{state.error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded transition-colors"
        >
          Reload
        </button>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="visualization-canvas-container bg-gray-900 rounded-lg overflow-hidden relative"
      style={{ height: '600px', width: '100%' }}
    >
      {state.isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 z-10">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
            <p>Loading visualization...</p>
          </div>
        </div>
      )}

      <div className="visualization-info p-4 border-b border-gray-700">
        <h3 className="text-white font-semibold">{visualization.name}</h3>
        <p className="text-gray-400 text-sm">{visualization.description}</p>
      </div>

      <canvas
        ref={canvasRef}
        className="block cursor-crosshair"
        style={{ width: '100%', height: 'calc(100% - 60px)' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => {}}
      />
    </div>
  )
}
