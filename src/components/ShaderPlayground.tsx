'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { ShaderManager } from '../lib/shader-management/ShaderManager'
import {
  ShaderPreset,
  ShaderPlaygroundState
} from '../types/shader'

interface ShaderPlaygroundProps {
  width?: number
  height?: number
  className?: string
}

export const ShaderPlayground: React.FC<ShaderPlaygroundProps> = ({
  width = 800,
  height = 600,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const glRef = useRef<WebGLRenderingContext | null>(null)
  const shaderManagerRef = useRef<ShaderManager | null>(null)
  const animationFrameRef = useRef<number>()
  const startTimeRef = useRef<number>(Date.now())

  const [state, setState] = useState<ShaderPlaygroundState>({
    currentPreset: 'basic',
    uniforms: {
      time: 0,
      resolution: [width, height],
      mouse: [0, 0]
    },
    isPlaying: true,
    showControls: true
  })

  const [error, setError] = useState<string | null>(null)

  // Basic vertex shader for full-screen quad
  const basicVertexShader = `
    attribute vec2 a_position;
    varying vec2 v_uv;

    void main() {
      v_uv = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `

  // Basic fragment shader presets
  const shaderPresets: ShaderPreset[] = React.useMemo(() => [
    {
      id: 'basic',
      name: 'Basic Colors',
      description: 'Simple color gradient',
      vertexShader: basicVertexShader,
      fragmentShader: `
        precision mediump float;
        uniform float time;
        uniform vec2 resolution;
        varying vec2 v_uv;

        void main() {
          vec2 uv = v_uv;
          vec3 color = vec3(
            sin(time + uv.x * 3.14159) * 0.5 + 0.5,
            sin(time + uv.y * 3.14159) * 0.5 + 0.5,
            sin(time + (uv.x + uv.y) * 3.14159) * 0.5 + 0.5
          );
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      defaultUniforms: {
        time: 0,
        resolution: [width, height]
      }
    },
    {
      id: 'waves',
      name: 'Wave Pattern',
      description: 'Animated wave interference',
      vertexShader: basicVertexShader,
      fragmentShader: `
        precision mediump float;
        uniform float time;
        uniform vec2 resolution;
        uniform vec2 mouse;
        varying vec2 v_uv;

        void main() {
          vec2 uv = (v_uv - 0.5) * 2.0;
          vec2 mouseUV = (mouse / resolution - 0.5) * 2.0;

          float wave1 = sin(length(uv - mouseUV) * 10.0 - time * 3.0);
          float wave2 = sin(length(uv + mouseUV) * 8.0 - time * 2.0);
          float wave3 = sin(uv.x * 5.0 + time * 1.5) * sin(uv.y * 5.0 + time * 1.5);

          float intensity = (wave1 + wave2 + wave3) / 3.0;
          vec3 color = vec3(
            intensity * 0.5 + 0.5,
            abs(intensity),
            1.0 - abs(intensity)
          );

          gl_FragColor = vec4(color, 1.0);
        }
      `,
      defaultUniforms: {
        time: 0,
        resolution: [width, height],
        mouse: [0, 0]
      }
    }
  ], [basicVertexShader, width, height])

  // Initialize WebGL and shader manager
  const initializeGL = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return false

    const gl =
      canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (!gl) {
      setError('WebGL not supported')
      return false
    }

    const webglContext = gl as WebGLRenderingContext
    glRef.current = webglContext
    shaderManagerRef.current = new ShaderManager(webglContext)

    // Set up viewport
    webglContext.viewport(0, 0, canvas.width, canvas.height)

    // Create full-screen quad
    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])

    const positionBuffer = webglContext.createBuffer()
    webglContext.bindBuffer(webglContext.ARRAY_BUFFER, positionBuffer)
    webglContext.bufferData(
      webglContext.ARRAY_BUFFER,
      positions,
      webglContext.STATIC_DRAW
    )

    return true
  }, [])

  // Load shader preset
  const loadPreset = useCallback(
    (presetId: string) => {
      const preset = shaderPresets.find((p) => p.id === presetId)
      if (!preset || !shaderManagerRef.current) {
        console.warn(`Preset ${presetId} not found or shader manager not available`)
        return
      }

      try {
        // Create or recreate the shader program
        shaderManagerRef.current.createProgram(
          preset.id,
          preset.vertexShader,
          preset.fragmentShader
        )

        setState((prev) => ({
          ...prev,
          currentPreset: presetId,
          uniforms: { ...prev.uniforms, ...preset.defaultUniforms }
        }))

        setError(null)
        console.log(`Loaded shader preset: ${preset.name}`)
      } catch (err) {
        console.error(`Failed to load preset ${presetId}:`, err)
        setError(err instanceof Error ? err.message : 'Failed to load shader')
      }
    },
    [shaderPresets]
  )

  // Render frame
  const render = useCallback(() => {
    const gl = glRef.current
    const shaderManager = shaderManagerRef.current
    if (!gl || !shaderManager) {
      console.warn('WebGL context or shader manager not available')
      return
    }

    const currentTime = (Date.now() - startTimeRef.current) / 1000

    setState((prevState) => {
      // Update uniforms
      const updatedUniforms = {
        ...prevState.uniforms,
        time: prevState.isPlaying ? currentTime : prevState.uniforms.time || 0
      }

      try {
        // Clear canvas
        gl.clearColor(0, 0, 0, 1)
        gl.clear(gl.COLOR_BUFFER_BIT)

        // Use shader program
        shaderManager.useProgram(prevState.currentPreset)

        // Set uniforms
        shaderManager.setUniforms(prevState.currentPreset, updatedUniforms)

        // Set up attributes
        const program = shaderManager.useProgram(prevState.currentPreset)
        const positionLocation = gl.getAttribLocation(program, 'a_position')

        if (positionLocation === -1) {
          console.warn('Position attribute not found in shader')
          return prevState
        }

        gl.enableVertexAttribArray(positionLocation)
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

        // Draw
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

        return { ...prevState, uniforms: updatedUniforms }
      } catch (err) {
        console.error('Render error:', err)
        setError(err instanceof Error ? err.message : 'Render failed')
        return prevState
      }
    })
  }, [])

  // Animation loop
  useEffect(() => {
    if (!state.isPlaying) {
      // If not playing, still render once to show current state
      render()
      return
    }

    const animate = () => {
      render()
      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [state.isPlaying, render])

  // Force render when preset changes
  useEffect(() => {
    render()
  }, [state.currentPreset, render])

  // Handle mouse movement
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = rect.height - (event.clientY - rect.top) // Flip Y coordinate

      setState((prev) => ({
        ...prev,
        uniforms: {
          ...prev.uniforms,
          mouse: [x, y]
        }
      }))
    },
    []
  )

  // Initialize on mount
  useEffect(() => {
    if (initializeGL()) {
      loadPreset('basic')
    }

    return () => {
      if (shaderManagerRef.current) {
        shaderManagerRef.current.dispose()
      }
    }
  }, [initializeGL, loadPreset])

  // Handle play/pause
  const togglePlayback = () => {
    setState((prev) => ({ ...prev, isPlaying: !prev.isPlaying }))
  }

  return (
    <div className={`shader-playground ${className}`}>
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="border border-gray-600 cursor-crosshair rounded"
          onMouseMove={handleMouseMove}
        />

        {error && (
          <div className="absolute top-2 left-2 bg-red-500 text-white px-3 py-1 rounded text-sm">
            {error}
          </div>
        )}
      </div>

      {state.showControls && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-4">
            <button
              onClick={togglePlayback}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
              {state.isPlaying ? 'Pause' : 'Play'}
            </button>

            <select
              value={state.currentPreset}
              onChange={(e) => loadPreset(e.target.value)}
              className="px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {shaderPresets.map((preset) => (
                <option key={preset.id} value={preset.id} className="bg-gray-800 text-white">
                  {preset.name}
                </option>
              ))}
            </select>

            <button
              onClick={() =>
                setState((prev) => ({
                  ...prev,
                  showControls: !prev.showControls
                }))
              }
              className="px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded hover:bg-gray-700 transition-colors">
              {state.showControls ? 'Hide' : 'Show'} Controls
            </button>
          </div>

          <div className="text-sm text-gray-300">
            <p>
              Current:{' '}
              {
                shaderPresets.find((p) => p.id === state.currentPreset)
                  ?.description
              }
            </p>
            <p>Time: {state.uniforms.time?.toFixed(2)}s</p>
            <p>
              Mouse: [{state.uniforms.mouse?.[0]?.toFixed(0)},{' '}
              {state.uniforms.mouse?.[1]?.toFixed(0)}]
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default ShaderPlayground
