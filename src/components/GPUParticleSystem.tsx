'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { ShaderManager } from '../lib/shader-management/ShaderManager'

interface ParticleSystemProps {
  width?: number
  height?: number
  className?: string
}

interface ParticlePreset {
  id: string
  name: string
  description: string
  particleCount: number
  parameters: ParticleParameters
}

interface ParticleParameters {
  speed: number
  size: number
  gravity: number
  attraction: number
  damping: number
  colorMode: number
  turbulence: number
  lifespan: number
}

interface ParticleSystemState {
  currentPreset: string
  parameters: ParticleParameters
  isPlaying: boolean
  showControls: boolean
  mousePosition: [number, number]
  mousePressed: boolean
}

export const GPUParticleSystem: React.FC<ParticleSystemProps> = ({
  width = 800,
  height = 600,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const glRef = useRef<WebGLRenderingContext | null>(null)
  const shaderManagerRef = useRef<ShaderManager | null>(null)
  const animationFrameRef = useRef<number>()
  const startTimeRef = useRef<number>(Date.now())
  const particleBufferRef = useRef<WebGLBuffer | null>(null)

  const [state, setState] = useState<ParticleSystemState>({
    currentPreset: 'basic',
    parameters: {
      speed: 1.0,
      size: 2.0,
      gravity: 0.1,
      attraction: 0.5,
      damping: 0.99,
      colorMode: 0,
      turbulence: 0.1,
      lifespan: 5.0
    },
    isPlaying: true,
    showControls: true,
    mousePosition: [0, 0],
    mousePressed: false
  })

  const [error, setError] = useState<string | null>(null)

  // Particle system presets
  const particlePresets: ParticlePreset[] = React.useMemo(() => [
    {
      id: 'basic',
      name: 'Basic Particles',
      description: 'Simple floating particles',
      particleCount: 1000,
      parameters: {
        speed: 1.0,
        size: 5.0,
        gravity: 0.1,
        attraction: 0.5,
        damping: 0.99,
        colorMode: 0,
        turbulence: 0.1,
        lifespan: 5.0
      }
    },
    {
      id: 'fireworks',
      name: 'Fireworks',
      description: 'Explosive particle effects',
      particleCount: 2000,
      parameters: {
        speed: 3.0,
        size: 5.5,
        gravity: 0.3,
        attraction: 0.0,
        damping: 0.95,
        colorMode: 1,
        turbulence: 0.5,
        lifespan: 3.0
      }
    },
    {
      id: 'galaxy',
      name: 'Galaxy Spiral',
      description: 'Spiral galaxy simulation',
      particleCount: 1500,
      parameters: {
        speed: 0.5,
        size: 5.0,
        gravity: 0.0,
        attraction: 1.0,
        damping: 1.0,
        colorMode: 2,
        turbulence: 0.0,
        lifespan: 10.0
      }
    },
    {
      id: 'fluid',
      name: 'Fluid Dynamics',
      description: 'Fluid-like particle behavior',
      particleCount: 800,
      parameters: {
        speed: 2.0,
        size: 5.0,
        gravity: 0.2,
        attraction: 0.8,
        damping: 0.98,
        colorMode: 3,
        turbulence: 0.3,
        lifespan: 8.0
      }
    }
  ], [])

  // Vertex shader for particle rendering
  const particleVertexShader = `
    precision mediump float;

    attribute vec2 a_position;

    uniform float u_time;
    uniform vec2 u_resolution;
    uniform vec2 u_mouse;
    uniform float u_speed;
    uniform float u_size;
    uniform float u_gravity;
    uniform float u_attraction;
    uniform float u_damping;
    uniform float u_turbulence;
    uniform float u_lifespan;
    uniform bool u_mousePressed;

    varying float v_life;
    varying float v_id;
    varying vec2 v_position;

    // Simple noise function
    float noise(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      // Use position as a unique identifier for each particle
      float id = dot(a_position, vec2(12.9898, 78.233));

      // Calculate animated position based on time and particle ID
      vec2 basePos = a_position;

      // Add some movement based on time and particle properties
      vec2 offset = vec2(
        sin(u_time * u_speed + id * 0.1) * 0.3,
        cos(u_time * u_speed * 0.7 + id * 0.15) * 0.3
      );

      // Add gravity effect
      offset.y -= u_gravity * u_time * 0.1;

      // Add turbulence
      vec2 turbulence = vec2(
        noise(basePos + u_time * 0.1) - 0.5,
        noise(basePos.yx + u_time * 0.1) - 0.5
      ) * u_turbulence;

      vec2 finalPos = basePos + offset + turbulence;

      // Mouse attraction
      if (u_mousePressed) {
        vec2 mousePos = (u_mouse / u_resolution) * 2.0 - 1.0;
        mousePos.y *= -1.0; // Flip Y coordinate
        vec2 toMouse = mousePos - finalPos;
        float dist = length(toMouse);
        if (dist > 0.0 && dist < 1.0) {
          finalPos += normalize(toMouse) * u_attraction * 0.01 / (dist + 0.1);
        }
      }

      // Wrap around screen edges
      finalPos.x = mod(finalPos.x + 1.0, 2.0) - 1.0;
      finalPos.y = mod(finalPos.y + 1.0, 2.0) - 1.0;

      // Calculate life based on time
      float life = mod(u_time * 0.5 + id * 0.1, u_lifespan) / u_lifespan;
      life = 1.0 - life; // Reverse so particles fade out

      // Set point size based on life and parameters
      gl_PointSize = u_size * (life * 0.8 + 0.2);
      gl_Position = vec4(finalPos, 0.0, 1.0);

      // Pass to fragment shader
      v_life = life;
      v_id = id;
      v_position = finalPos;
    }
  `

  // Fragment shader for particle rendering
  const particleFragmentShader = `
    precision mediump float;

    uniform float u_time;
    uniform float u_colorMode;

    varying float v_life;
    varying float v_id;
    varying vec2 v_position;

    vec3 hsv2rgb(vec3 c) {
      vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
      vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
      return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }

    void main() {
      // Create circular particles
      vec2 coord = gl_PointCoord - 0.5;
      float dist = length(coord);
      if (dist > 0.5) discard;

      vec3 color;
      float alpha = (1.0 - dist * 2.0) * v_life;

      if (u_colorMode < 0.5) {
        // Basic: Life-based color
        color = mix(vec3(1.0, 0.0, 0.0), vec3(0.0, 0.0, 1.0), v_life);
      } else if (u_colorMode < 1.5) {
        // Fireworks: Hot colors
        float hue = v_id * 0.1 + u_time * 0.5;
        color = hsv2rgb(vec3(hue, 1.0, v_life));
      } else if (u_colorMode < 2.5) {
        // Galaxy: Blue-white gradient
        color = mix(vec3(0.1, 0.1, 0.8), vec3(1.0, 1.0, 1.0), v_life * 0.8);
      } else {
        // Fluid: Position-based color
        float speed = length(v_position) * 2.0;
        color = hsv2rgb(vec3(speed * 0.5 + 0.6, 0.8, v_life));
      }

      gl_FragColor = vec4(color, alpha);
    }
  `

  // Initialize WebGL and create particle buffers
  const initializeGL = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return false

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (!gl) {
      setError('WebGL not supported')
      return false
    }

    const webglContext = gl as WebGLRenderingContext
    glRef.current = webglContext
    shaderManagerRef.current = new ShaderManager(webglContext)

    // Set up viewport
    webglContext.viewport(0, 0, canvas.width, canvas.height)

    // Enable blending for particle effects
    webglContext.enable(webglContext.BLEND)
    webglContext.blendFunc(webglContext.SRC_ALPHA, webglContext.ONE_MINUS_SRC_ALPHA)

    return true
  }, [])

  // Create particle buffers
  const createParticleBuffers = useCallback((particleCount: number) => {
    const gl = glRef.current
    if (!gl) return

    // Create particle position data
    const positions = new Float32Array(particleCount * 2)

    // Initialize particles randomly
    for (let i = 0; i < particleCount; i++) {
      positions[i * 2] = (Math.random() - 0.5) * 2
      positions[i * 2 + 1] = (Math.random() - 0.5) * 2
    }

    // Create and populate buffer
    particleBufferRef.current = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, particleBufferRef.current)
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)
  }, [])

  // Load particle preset
  const loadPreset = useCallback((presetId: string) => {
    const preset = particlePresets.find(p => p.id === presetId)
    if (!preset || !shaderManagerRef.current) return

    try {
      // Create shader program if it doesn't exist
      if (!shaderManagerRef.current.hasProgram('particles')) {
        shaderManagerRef.current.createProgram(
          'particles',
          particleVertexShader,
          particleFragmentShader
        )
      }

      // Create particle buffers
      createParticleBuffers(preset.particleCount)

      setState(prev => ({
        ...prev,
        currentPreset: presetId,
        parameters: { ...preset.parameters }
      }))

      setError(null)
    } catch (err) {
      console.error(`Failed to load preset ${presetId}:`, err)
      setError(err instanceof Error ? err.message : 'Failed to load preset')
    }
  }, [particlePresets, createParticleBuffers, particleVertexShader, particleFragmentShader])

  // Render particles
  const render = useCallback(() => {
    const gl = glRef.current
    const shaderManager = shaderManagerRef.current
    if (!gl || !shaderManager || !particleBufferRef.current) return

    const currentTime = (Date.now() - startTimeRef.current) / 1000

    try {
      // Clear canvas
      gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)

      // Use particle shader
      const program = shaderManager.useProgram('particles')

      // Set uniforms
      const uniforms = {
        u_time: state.isPlaying ? currentTime : 0,
        u_resolution: [width, height],
        u_mouse: state.mousePosition,
        u_mousePressed: state.mousePressed,
        u_speed: state.parameters.speed,
        u_size: state.parameters.size,
        u_gravity: state.parameters.gravity,
        u_attraction: state.parameters.attraction,
        u_damping: state.parameters.damping,
        u_colorMode: state.parameters.colorMode,
        u_turbulence: state.parameters.turbulence,
        u_lifespan: state.parameters.lifespan
      }

      shaderManager.setUniforms('particles', uniforms)

      // Set up vertex attributes (simplified - in real implementation you'd update positions)
      const positionLocation = gl.getAttribLocation(program, 'a_position')
      if (positionLocation !== -1) {
        gl.bindBuffer(gl.ARRAY_BUFFER, particleBufferRef.current)
        gl.enableVertexAttribArray(positionLocation)
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)
      }

      // Draw particles as points
      const preset = particlePresets.find(p => p.id === state.currentPreset)
      if (preset) {
        gl.drawArrays(gl.POINTS, 0, preset.particleCount)
      }

    } catch (err) {
      console.error('Render error:', err)
      setError(err instanceof Error ? err.message : 'Render failed')
    }
  }, [state, width, height, particlePresets])

  // Animation loop
  useEffect(() => {
    if (!state.isPlaying) {
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

  // Handle mouse events
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    setState(prev => ({
      ...prev,
      mousePosition: [x, y]
    }))
  }, [])

  const handleMouseDown = useCallback(() => {
    setState(prev => ({ ...prev, mousePressed: true }))
  }, [])

  const handleMouseUp = useCallback(() => {
    setState(prev => ({ ...prev, mousePressed: false }))
  }, [])

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

  // Parameter update handlers
  const updateParameter = useCallback((key: keyof ParticleParameters, value: number) => {
    setState(prev => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        [key]: value
      }
    }))
  }, [])

  const togglePlayback = () => {
    setState(prev => ({ ...prev, isPlaying: !prev.isPlaying }))
  }

  return (
    <div className={`gpu-particle-system ${className}`}>
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="border border-gray-600 cursor-crosshair rounded bg-black"
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />

        {error && (
          <div className="absolute top-2 left-2 bg-red-500 text-white px-3 py-1 rounded text-sm">
            {error}
          </div>
        )}
      </div>

      {state.showControls && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={togglePlayback}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
              {state.isPlaying ? 'Pause' : 'Play'}
            </button>

            <select
              value={state.currentPreset}
              onChange={(e) => loadPreset(e.target.value)}
              className="px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {particlePresets.map((preset) => (
                <option key={preset.id} value={preset.id} className="bg-gray-800 text-white">
                  {preset.name}
                </option>
              ))}
            </select>

            <button
              onClick={() => setState(prev => ({ ...prev, showControls: !prev.showControls }))}
              className="px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded hover:bg-gray-700 transition-colors">
              {state.showControls ? 'Hide' : 'Show'} Controls
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Speed</label>
              <input
                type="range"
                min="0"
                max="5"
                step="0.1"
                value={state.parameters.speed}
                onChange={(e) => updateParameter('speed', parseFloat(e.target.value))}
                className="w-full"
              />
              <span className="text-xs text-gray-400">{state.parameters.speed.toFixed(1)}</span>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1">Size</label>
              <input
                type="range"
                min="0.5"
                max="10"
                step="0.1"
                value={state.parameters.size}
                onChange={(e) => updateParameter('size', parseFloat(e.target.value))}
                className="w-full"
              />
              <span className="text-xs text-gray-400">{state.parameters.size.toFixed(1)}</span>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1">Gravity</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={state.parameters.gravity}
                onChange={(e) => updateParameter('gravity', parseFloat(e.target.value))}
                className="w-full"
              />
              <span className="text-xs text-gray-400">{state.parameters.gravity.toFixed(2)}</span>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1">Attraction</label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={state.parameters.attraction}
                onChange={(e) => updateParameter('attraction', parseFloat(e.target.value))}
                className="w-full"
              />
              <span className="text-xs text-gray-400">{state.parameters.attraction.toFixed(1)}</span>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1">Damping</label>
              <input
                type="range"
                min="0.9"
                max="1"
                step="0.001"
                value={state.parameters.damping}
                onChange={(e) => updateParameter('damping', parseFloat(e.target.value))}
                className="w-full"
              />
              <span className="text-xs text-gray-400">{state.parameters.damping.toFixed(3)}</span>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1">Turbulence</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={state.parameters.turbulence}
                onChange={(e) => updateParameter('turbulence', parseFloat(e.target.value))}
                className="w-full"
              />
              <span className="text-xs text-gray-400">{state.parameters.turbulence.toFixed(2)}</span>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1">Lifespan</label>
              <input
                type="range"
                min="1"
                max="20"
                step="0.5"
                value={state.parameters.lifespan}
                onChange={(e) => updateParameter('lifespan', parseFloat(e.target.value))}
                className="w-full"
              />
              <span className="text-xs text-gray-400">{state.parameters.lifespan.toFixed(1)}s</span>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1">Color Mode</label>
              <select
                value={state.parameters.colorMode}
                onChange={(e) => updateParameter('colorMode', parseInt(e.target.value))}
                className="w-full px-2 py-1 bg-gray-800 text-white border border-gray-600 rounded text-sm">
                <option value={0}>Life-based</option>
                <option value={1}>Fireworks</option>
                <option value={2}>Galaxy</option>
                <option value={3}>Velocity</option>
              </select>
            </div>
          </div>

          <div className="text-sm text-gray-300">
            <p>Current: {particlePresets.find(p => p.id === state.currentPreset)?.description}</p>
            <p>Particles: {particlePresets.find(p => p.id === state.currentPreset)?.particleCount}</p>
            <p>Mouse: [{state.mousePosition[0].toFixed(0)}, {state.mousePosition[1].toFixed(0)}] {state.mousePressed ? '(pressed)' : ''}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default GPUParticleSystem
