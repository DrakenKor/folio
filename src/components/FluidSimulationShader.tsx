'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { ShaderManager } from '../lib/shader-management/ShaderManager'
import { ShaderUniforms } from '../types/shader'

interface FluidSimulationProps {
  width?: number
  height?: number
  className?: string
}

interface FluidControls {
  viscosity: number
  density: number
  pressure: number
  colorIntensity: number
  flowSpeed: number
}

export const FluidSimulationShader: React.FC<FluidSimulationProps> = ({
  width = 800,
  height = 600,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const glRef = useRef<WebGLRenderingContext | null>(null)
  const shaderManagerRef = useRef<ShaderManager | null>(null)
  const animationFrameRef = useRef<number>()
  const startTimeRef = useRef<number>(Date.now())
  const mousePositionRef = useRef<[number, number]>([0, 0])
  const mouseVelocityRef = useRef<[number, number]>([0, 0])
  const lastMousePositionRef = useRef<[number, number]>([0, 0])

  const [isPlaying, setIsPlaying] = useState(true)
  const [showControls, setShowControls] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [controls, setControls] = useState<FluidControls>({
    viscosity: 0.8,
    density: 1.2,
    pressure: 0.5,
    colorIntensity: 1.0,
    flowSpeed: 1.0
  })

  // Vertex shader for full-screen quad
  const vertexShader = `
    attribute vec2 a_position;
    varying vec2 v_uv;

    void main() {
      v_uv = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `

  // Fluid simulation fragment shader
  const fragmentShader = `
    precision mediump float;

    uniform float time;
    uniform vec2 resolution;
    uniform vec2 mouse;
    uniform vec2 mouseVelocity;
    uniform float viscosity;
    uniform float density;
    uniform float pressure;
    uniform float colorIntensity;
    uniform float flowSpeed;

    varying vec2 v_uv;

    // Noise function for fluid turbulence
    float noise(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    // Smooth noise
    float smoothNoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);

      float a = noise(i);
      float b = noise(i + vec2(1.0, 0.0));
      float c = noise(i + vec2(0.0, 1.0));
      float d = noise(i + vec2(1.0, 1.0));

      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    // Fractal noise
    float fractalNoise(vec2 p) {
      float value = 0.0;
      float amplitude = 0.5;

      for (int i = 0; i < 4; i++) {
        value += amplitude * smoothNoise(p);
        p *= 2.0;
        amplitude *= 0.5;
      }

      return value;
    }

    // Velocity field based on mouse interaction
    vec2 getVelocityField(vec2 pos) {
      vec2 mousePos = mouse / resolution;
      vec2 toMouse = pos - mousePos;
      float dist = length(toMouse);

      // Create swirling motion around mouse
      vec2 velocity = vec2(-toMouse.y, toMouse.x) * (1.0 / (dist + 0.1));

      // Add mouse velocity influence
      velocity += mouseVelocity * exp(-dist * 5.0) * flowSpeed;

      // Add some turbulence
      float turbulence = fractalNoise(pos * 8.0 + time * 0.5);
      velocity += vec2(cos(turbulence * 6.28), sin(turbulence * 6.28)) * 0.1;

      return velocity * viscosity;
    }

    // Pressure field calculation
    float getPressure(vec2 pos) {
      vec2 mousePos = mouse / resolution;
      float dist = length(pos - mousePos);

      // Pressure decreases with distance from mouse
      float mousePressure = exp(-dist * 3.0) * pressure;

      // Add some noise-based pressure variations
      float noisePressure = fractalNoise(pos * 4.0 + time * 0.3) * 0.2;

      return mousePressure + noisePressure;
    }

    // Density field with advection
    float getDensity(vec2 pos) {
      vec2 velocity = getVelocityField(pos);

      // Advect position backwards in time
      vec2 advectedPos = pos - velocity * 0.02;

      // Sample density at advected position
      float baseDensity = fractalNoise(advectedPos * 6.0 + time * 0.2);

      // Add mouse influence
      vec2 mousePos = mouse / resolution;
      float mouseDist = length(pos - mousePos);
      float mouseInfluence = exp(-mouseDist * 4.0);

      return (baseDensity + mouseInfluence) * density;
    }

    // Color mapping based on fluid properties
    vec3 getFluidColor(vec2 pos) {
      vec2 velocity = getVelocityField(pos);
      float pressure = getPressure(pos);
      float densityValue = getDensity(pos);

      // Velocity magnitude for color intensity
      float velocityMag = length(velocity);

      // Create color based on fluid properties
      vec3 color = vec3(0.0);

      // Velocity-based coloring (blue to red)
      color.r = velocityMag * 2.0;
      color.g = pressure * 1.5;
      color.b = densityValue * 1.2;

      // Add some iridescent effects
      float phase = atan(velocity.y, velocity.x) + time;
      color += vec3(
        sin(phase) * 0.3,
        sin(phase + 2.094) * 0.3,
        sin(phase + 4.188) * 0.3
      ) * velocityMag;

      return color * colorIntensity;
    }

    void main() {
      vec2 uv = v_uv;

      // Get fluid color
      vec3 fluidColor = getFluidColor(uv);

      // Add some glow effect
      float glow = 0.0;
      for (int i = 0; i < 8; i++) {
        float angle = float(i) * 0.785398; // PI/4
        vec2 offset = vec2(cos(angle), sin(angle)) * 0.01;
        glow += length(getFluidColor(uv + offset)) * 0.125;
      }

      fluidColor += vec3(glow * 0.3);

      // Tone mapping and gamma correction
      fluidColor = fluidColor / (fluidColor + vec3(1.0));
      fluidColor = pow(fluidColor, vec3(1.0 / 2.2));

      gl_FragColor = vec4(fluidColor, 1.0);
    }
  `

  // Initialize WebGL and shader manager
  const initializeGL = useCallback(async () => {
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

    // Create shader program
    try {
      shaderManagerRef.current.createProgram(
        'fluid',
        vertexShader,
        fragmentShader
      )
      setError(null)
      setIsInitialized(true)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create shader')
      setIsInitialized(false)
      return false
    }
  }, [vertexShader, fragmentShader])

  // Handle mouse movement
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = rect.height - (event.clientY - rect.top) // Flip Y coordinate

      const newPosition: [number, number] = [x, y]
      const lastPosition = lastMousePositionRef.current

      // Calculate mouse velocity
      const velocity: [number, number] = [
        (newPosition[0] - lastPosition[0]) * 0.1,
        (newPosition[1] - lastPosition[1]) * 0.1
      ]

      mousePositionRef.current = newPosition
      mouseVelocityRef.current = velocity
      lastMousePositionRef.current = newPosition
    },
    []
  )

  // Render frame
  const render = useCallback(() => {
    const gl = glRef.current
    const shaderManager = shaderManagerRef.current
    if (!gl || !shaderManager) return

    // Check if shader program is ready
    if (!shaderManager.hasProgram('fluid')) {
      return // Skip rendering if shader isn't ready yet
    }

    const currentTime = (Date.now() - startTimeRef.current) / 1000

    // Decay mouse velocity
    mouseVelocityRef.current = [
      mouseVelocityRef.current[0] * 0.95,
      mouseVelocityRef.current[1] * 0.95
    ]

    const uniforms: ShaderUniforms = {
      time: isPlaying ? currentTime : 0,
      resolution: [width, height],
      mouse: mousePositionRef.current,
      mouseVelocity: mouseVelocityRef.current,
      viscosity: controls.viscosity,
      density: controls.density,
      pressure: controls.pressure,
      colorIntensity: controls.colorIntensity,
      flowSpeed: controls.flowSpeed
    }

    try {
      // Clear canvas
      gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)

      // Use shader program
      const program = shaderManager.useProgram('fluid')

      // Set uniforms
      shaderManager.setUniforms('fluid', uniforms)

      // Set up attributes
      const positionLocation = gl.getAttribLocation(program, 'a_position')

      gl.enableVertexAttribArray(positionLocation)
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

      // Draw
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    } catch (err) {
      console.error('Render error:', err)
      setError(err instanceof Error ? err.message : 'Render failed')
    }
  }, [isPlaying, width, height, controls])

  // Animation loop
  useEffect(() => {
    if (!isPlaying || !isInitialized) return

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
  }, [isPlaying, isInitialized, render])

  // Initialize on mount
  useEffect(() => {
    let mounted = true

    const init = async () => {
      const success = await initializeGL()
      if (!success && mounted) {
        console.warn('Failed to initialize WebGL for fluid simulation')
      }
    }

    init()

    return () => {
      mounted = false
      if (shaderManagerRef.current) {
        shaderManagerRef.current.dispose()
      }
    }
  }, [initializeGL])

  // Control handlers
  const handleControlChange = (key: keyof FluidControls, value: number) => {
    setControls((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className={`fluid-simulation ${className}`}>
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="border border-gray-300 cursor-crosshair"
          onMouseMove={handleMouseMove}
        />

        {!isInitialized && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="text-white text-lg">Initializing WebGL...</div>
          </div>
        )}

        {error && (
          <div className="absolute top-2 left-2 bg-red-500 text-white px-3 py-1 rounded text-sm">
            {error}
          </div>
        )}
      </div>

      {showControls && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
              {isPlaying ? 'Pause' : 'Play'}
            </button>

            <button
              onClick={() => setShowControls(!showControls)}
              className="px-3 py-2 border border-gray-300 rounded hover:bg-gray-50">
              {showControls ? 'Hide' : 'Show'} Controls
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Viscosity
              </label>
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.1"
                value={controls.viscosity}
                onChange={(e) =>
                  handleControlChange('viscosity', parseFloat(e.target.value))
                }
                className="w-full"
              />
              <span className="text-xs text-gray-500">
                {controls.viscosity.toFixed(1)}
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Density</label>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.1"
                value={controls.density}
                onChange={(e) =>
                  handleControlChange('density', parseFloat(e.target.value))
                }
                className="w-full"
              />
              <span className="text-xs text-gray-500">
                {controls.density.toFixed(1)}
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Pressure</label>
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.1"
                value={controls.pressure}
                onChange={(e) =>
                  handleControlChange('pressure', parseFloat(e.target.value))
                }
                className="w-full"
              />
              <span className="text-xs text-gray-500">
                {controls.pressure.toFixed(1)}
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Color Intensity
              </label>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.1"
                value={controls.colorIntensity}
                onChange={(e) =>
                  handleControlChange(
                    'colorIntensity',
                    parseFloat(e.target.value)
                  )
                }
                className="w-full"
              />
              <span className="text-xs text-gray-500">
                {controls.colorIntensity.toFixed(1)}
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Flow Speed
              </label>
              <input
                type="range"
                min="0.1"
                max="3.0"
                step="0.1"
                value={controls.flowSpeed}
                onChange={(e) =>
                  handleControlChange('flowSpeed', parseFloat(e.target.value))
                }
                className="w-full"
              />
              <span className="text-xs text-gray-500">
                {controls.flowSpeed.toFixed(1)}
              </span>
            </div>
          </div>

          <div className="text-sm text-gray-600">
            <p>
              Move your mouse over the canvas to interact with the fluid
              simulation.
            </p>
            <p>
              The fluid responds to mouse movement with swirling patterns and
              color changes.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
