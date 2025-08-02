'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { ShaderManager } from '../lib/shader-management/ShaderManager'
import { ShaderUniforms } from '../types/shader'

interface RaymarchingRendererProps {
  width?: number
  height?: number
  className?: string
}

interface RaymarchingScene {
  id: string
  name: string
  description: string
  fragmentShader: string
  defaultUniforms: ShaderUniforms
}

interface CameraState {
  position: [number, number, number]
  target: [number, number, number]
  fov: number
}

interface RaymarchingState {
  currentScene: string
  uniforms: ShaderUniforms
  camera: CameraState
  isPlaying: boolean
  showControls: boolean
  mouseDown: boolean
  lastMousePos: [number, number]
}

export const RaymarchingRenderer: React.FC<RaymarchingRendererProps> = ({
  width = 800,
  height = 600,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const glRef = useRef<WebGLRenderingContext | null>(null)
  const shaderManagerRef = useRef<ShaderManager | null>(null)
  const animationFrameRef = useRef<number>()
  const startTimeRef = useRef<number>(Date.now())

  const [state, setState] = useState<RaymarchingState>({
    currentScene: 'basic-sphere',
    uniforms: {
      time: 0,
      resolution: [width, height],
      mouse: [0, 0],
      cameraPos: [0, 0, 5],
      cameraTarget: [0, 0, 0],
      fov: 45
    },
    camera: {
      position: [0, 0, 5],
      target: [0, 0, 0],
      fov: 45
    },
    isPlaying: true,
    showControls: true,
    mouseDown: false,
    lastMousePos: [0, 0]
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

  // Raymarching scene presets
  const scenePresets: RaymarchingScene[] = React.useMemo(() => [
    {
      id: 'basic-sphere',
      name: 'Basic Sphere',
      description: 'Simple sphere with basic lighting',
      fragmentShader: `
        precision mediump float;
        uniform float time;
        uniform vec2 resolution;
        uniform vec3 cameraPos;
        uniform vec3 cameraTarget;
        uniform float fov;
        varying vec2 v_uv;

        // Distance function for a sphere
        float sdSphere(vec3 p, float r) {
          return length(p) - r;
        }

        // Scene distance function
        float map(vec3 p) {
          float sphere = sdSphere(p, 1.0);
          return sphere;
        }

        // Calculate normal using gradient
        vec3 calcNormal(vec3 p) {
          const float eps = 0.001;
          return normalize(vec3(
            map(p + vec3(eps, 0, 0)) - map(p - vec3(eps, 0, 0)),
            map(p + vec3(0, eps, 0)) - map(p - vec3(0, eps, 0)),
            map(p + vec3(0, 0, eps)) - map(p - vec3(0, 0, eps))
          ));
        }

        // Raymarching function
        float raymarch(vec3 ro, vec3 rd) {
          float t = 0.0;
          for (int i = 0; i < 64; i++) {
            vec3 p = ro + t * rd;
            float d = map(p);
            if (d < 0.001 || t > 20.0) break;
            t += d;
          }
          return t;
        }

        void main() {
          vec2 uv = (v_uv - 0.5) * 2.0;
          uv.x *= resolution.x / resolution.y;

          // Camera setup
          vec3 ro = cameraPos;
          vec3 forward = normalize(cameraTarget - ro);
          vec3 right = normalize(cross(forward, vec3(0, 1, 0)));
          vec3 up = cross(right, forward);

          float fovRad = radians(fov);
          vec3 rd = normalize(forward + uv.x * right * tan(fovRad * 0.5) + uv.y * up * tan(fovRad * 0.5));

          // Raymarch
          float t = raymarch(ro, rd);

          vec3 color = vec3(0.1, 0.1, 0.2); // Background

          if (t < 20.0) {
            vec3 p = ro + t * rd;
            vec3 normal = calcNormal(p);

            // Simple lighting
            vec3 lightDir = normalize(vec3(1, 1, 1));
            float diff = max(dot(normal, lightDir), 0.0);

            color = vec3(0.8, 0.4, 0.2) * diff + vec3(0.1);
          }

          gl_FragColor = vec4(color, 1.0);
        }
      `,
      defaultUniforms: {
        time: 0,
        resolution: [width, height],
        cameraPos: [0, 0, 5],
        cameraTarget: [0, 0, 0],
        fov: 45
      }
    },
    {
      id: 'fractal-mandelbulb',
      name: 'Fractal Mandelbulb',
      description: '3D fractal with animated rotation',
      fragmentShader: `
        precision mediump float;
        uniform float time;
        uniform vec2 resolution;
        uniform vec3 cameraPos;
        uniform vec3 cameraTarget;
        uniform float fov;
        varying vec2 v_uv;

        // Mandelbulb distance estimation
        float mandelbulb(vec3 pos) {
          vec3 z = pos;
          float dr = 1.0;
          float r = 0.0;
          float power = 8.0 + 2.0 * sin(time * 0.5);

          for (int i = 0; i < 15; i++) {
            r = length(z);
            if (r > 2.0) break;

            // Convert to polar coordinates
            float theta = acos(z.z / r);
            float phi = atan(z.y, z.x);
            dr = pow(r, power - 1.0) * power * dr + 1.0;

            // Scale and rotate the point
            float zr = pow(r, power);
            theta = theta * power;
            phi = phi * power;

            // Convert back to cartesian coordinates
            z = zr * vec3(sin(theta) * cos(phi), sin(phi) * sin(theta), cos(theta));
            z += pos;
          }

          return 0.5 * log(r) * r / dr;
        }

        // Scene distance function
        float map(vec3 p) {
          // Rotate the scene
          float c = cos(time * 0.2);
          float s = sin(time * 0.2);
          mat3 rot = mat3(
            c, 0, s,
            0, 1, 0,
            -s, 0, c
          );
          p = rot * p;

          return mandelbulb(p);
        }

        // Calculate normal
        vec3 calcNormal(vec3 p) {
          const float eps = 0.001;
          return normalize(vec3(
            map(p + vec3(eps, 0, 0)) - map(p - vec3(eps, 0, 0)),
            map(p + vec3(0, eps, 0)) - map(p - vec3(0, eps, 0)),
            map(p + vec3(0, 0, eps)) - map(p - vec3(0, 0, eps))
          ));
        }

        // Raymarching
        float raymarch(vec3 ro, vec3 rd) {
          float t = 0.0;
          for (int i = 0; i < 128; i++) {
            vec3 p = ro + t * rd;
            float d = map(p);
            if (d < 0.001 || t > 20.0) break;
            t += d * 0.8; // Slower marching for fractals
          }
          return t;
        }

        void main() {
          vec2 uv = (v_uv - 0.5) * 2.0;
          uv.x *= resolution.x / resolution.y;

          // Camera setup
          vec3 ro = cameraPos;
          vec3 forward = normalize(cameraTarget - ro);
          vec3 right = normalize(cross(forward, vec3(0, 1, 0)));
          vec3 up = cross(right, forward);

          float fovRad = radians(fov);
          vec3 rd = normalize(forward + uv.x * right * tan(fovRad * 0.5) + uv.y * up * tan(fovRad * 0.5));

          // Raymarch
          float t = raymarch(ro, rd);

          vec3 color = vec3(0.05, 0.05, 0.1); // Background

          if (t < 20.0) {
            vec3 p = ro + t * rd;
            vec3 normal = calcNormal(p);

            // Enhanced lighting
            vec3 lightDir = normalize(vec3(sin(time), 1, cos(time)));
            float diff = max(dot(normal, lightDir), 0.0);
            float spec = pow(max(dot(reflect(-lightDir, normal), -rd), 0.0), 32.0);

            // Fractal coloring based on position
            vec3 baseColor = vec3(0.8, 0.4, 0.2) + 0.3 * sin(p * 3.0 + time);
            color = baseColor * diff + vec3(1.0) * spec + vec3(0.1);
          }

          gl_FragColor = vec4(color, 1.0);
        }
      `,
      defaultUniforms: {
        time: 0,
        resolution: [width, height],
        cameraPos: [0, 0, 3],
        cameraTarget: [0, 0, 0],
        fov: 45
      }
    },
    {
      id: 'geometric-city',
      name: 'Geometric City',
      description: 'Abstract cityscape with geometric shapes',
      fragmentShader: `
        precision mediump float;
        uniform float time;
        uniform vec2 resolution;
        uniform vec3 cameraPos;
        uniform vec3 cameraTarget;
        uniform float fov;
        varying vec2 v_uv;

        // Distance functions
        float sdBox(vec3 p, vec3 b) {
          vec3 q = abs(p) - b;
          return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
        }

        float sdCylinder(vec3 p, float h, float r) {
          vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
          return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
        }

        // Smooth minimum
        float smin(float a, float b, float k) {
          float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
          return mix(b, a, h) - k * h * (1.0 - h);
        }

        // Scene distance function
        float map(vec3 p) {
          float ground = p.y + 1.0;

          // Buildings
          float buildings = 1000.0;
          for (int i = 0; i < 8; i++) {
            float fi = float(i);
            vec3 pos = vec3(
              sin(fi * 2.3) * 5.0,
              0.0,
              cos(fi * 1.7) * 5.0
            );

            float height = 2.0 + 3.0 * sin(fi + time * 0.1);
            vec3 size = vec3(0.5 + 0.3 * sin(fi), height, 0.5 + 0.3 * cos(fi));

            float building = sdBox(p - pos - vec3(0, height, 0), size);
            buildings = min(buildings, building);
          }

          // Towers
          for (int i = 0; i < 4; i++) {
            float fi = float(i);
            vec3 pos = vec3(
              sin(fi * 3.1 + time * 0.05) * 8.0,
              0.0,
              cos(fi * 2.7 + time * 0.05) * 8.0
            );

            float height = 4.0 + 2.0 * sin(fi * 2.0 + time * 0.2);
            float tower = sdCylinder(p - pos - vec3(0, height, 0), height, 0.3);
            buildings = min(buildings, tower);
          }

          return min(ground, buildings);
        }

        // Calculate normal
        vec3 calcNormal(vec3 p) {
          const float eps = 0.001;
          return normalize(vec3(
            map(p + vec3(eps, 0, 0)) - map(p - vec3(eps, 0, 0)),
            map(p + vec3(0, eps, 0)) - map(p - vec3(0, eps, 0)),
            map(p + vec3(0, 0, eps)) - map(p - vec3(0, 0, eps))
          ));
        }

        // Raymarching
        float raymarch(vec3 ro, vec3 rd) {
          float t = 0.0;
          for (int i = 0; i < 96; i++) {
            vec3 p = ro + t * rd;
            float d = map(p);
            if (d < 0.001 || t > 50.0) break;
            t += d;
          }
          return t;
        }

        void main() {
          vec2 uv = (v_uv - 0.5) * 2.0;
          uv.x *= resolution.x / resolution.y;

          // Camera setup
          vec3 ro = cameraPos;
          vec3 forward = normalize(cameraTarget - ro);
          vec3 right = normalize(cross(forward, vec3(0, 1, 0)));
          vec3 up = cross(right, forward);

          float fovRad = radians(fov);
          vec3 rd = normalize(forward + uv.x * right * tan(fovRad * 0.5) + uv.y * up * tan(fovRad * 0.5));

          // Raymarch
          float t = raymarch(ro, rd);

          vec3 color = vec3(0.1, 0.1, 0.2); // Sky

          if (t < 50.0) {
            vec3 p = ro + t * rd;
            vec3 normal = calcNormal(p);

            // Lighting
            vec3 lightDir = normalize(vec3(sin(time * 0.1), 0.8, cos(time * 0.1)));
            float diff = max(dot(normal, lightDir), 0.0);
            float spec = pow(max(dot(reflect(-lightDir, normal), -rd), 0.0), 16.0);

            // Material based on height
            vec3 baseColor = mix(
              vec3(0.3, 0.3, 0.4), // Ground
              vec3(0.8, 0.6, 0.4), // Buildings
              smoothstep(-1.0, 2.0, p.y)
            );

            // Add some variation
            baseColor += 0.2 * sin(p * 2.0 + time);

            color = baseColor * diff + vec3(1.0) * spec * 0.5 + vec3(0.1);
          }

          gl_FragColor = vec4(color, 1.0);
        }
      `,
      defaultUniforms: {
        time: 0,
        resolution: [width, height],
        cameraPos: [0, 2, 8],
        cameraTarget: [0, 0, 0],
        fov: 60
      }
    }
  ], [width, height])

  // Initialize WebGL and shader manager
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

    // Create full-screen quad
    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])
    const positionBuffer = webglContext.createBuffer()
    webglContext.bindBuffer(webglContext.ARRAY_BUFFER, positionBuffer)
    webglContext.bufferData(webglContext.ARRAY_BUFFER, positions, webglContext.STATIC_DRAW)

    return true
  }, [])

  // Load scene preset
  const loadScene = useCallback((sceneId: string) => {
    const scene = scenePresets.find(s => s.id === sceneId)
    if (!scene || !shaderManagerRef.current) return

    try {
      shaderManagerRef.current.createProgram(scene.id, basicVertexShader, scene.fragmentShader)

      setState(prev => ({
        ...prev,
        currentScene: sceneId,
        uniforms: { ...prev.uniforms, ...scene.defaultUniforms }
      }))

      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scene')
    }
  }, [scenePresets, basicVertexShader])

  // Handle mouse interactions for camera control
  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    setState(prev => ({
      ...prev,
      mouseDown: true,
      lastMousePos: [event.clientX, event.clientY]
    }))
  }, [])

  const handleMouseUp = useCallback(() => {
    setState(prev => ({ ...prev, mouseDown: false }))
  }, [])

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = rect.height - (event.clientY - rect.top)

    setState(prev => {
      const newState = {
        ...prev,
        uniforms: {
          ...prev.uniforms,
          mouse: [x, y] as [number, number]
        }
      }

      // Camera rotation when mouse is down
      if (prev.mouseDown) {
        const deltaX = (event.clientX - prev.lastMousePos[0]) * 0.01
        const deltaY = (event.clientY - prev.lastMousePos[1]) * 0.01

        // Orbit camera around target
        const radius = Math.sqrt(
          Math.pow(prev.camera.position[0] - prev.camera.target[0], 2) +
          Math.pow(prev.camera.position[2] - prev.camera.target[2], 2)
        )

        const currentAngleY = Math.atan2(
          prev.camera.position[0] - prev.camera.target[0],
          prev.camera.position[2] - prev.camera.target[2]
        )

        const newAngleY = currentAngleY + deltaX
        const newY = Math.max(-5, Math.min(5, prev.camera.position[1] - deltaY))

        const newCameraPos: [number, number, number] = [
          prev.camera.target[0] + radius * Math.sin(newAngleY),
          newY,
          prev.camera.target[2] + radius * Math.cos(newAngleY)
        ]

        newState.camera = {
          ...prev.camera,
          position: newCameraPos
        }

        newState.uniforms = {
          ...newState.uniforms,
          cameraPos: newCameraPos
        }

        newState.lastMousePos = [event.clientX, event.clientY]
      }

      return newState
    })
  }, [])

  // Handle mouse wheel for zoom
  const handleWheel = useCallback((event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault()

    setState(prev => {
      const zoomFactor = event.deltaY > 0 ? 1.1 : 0.9
      const direction = [
        prev.camera.position[0] - prev.camera.target[0],
        prev.camera.position[1] - prev.camera.target[1],
        prev.camera.position[2] - prev.camera.target[2]
      ]

      const newCameraPos: [number, number, number] = [
        prev.camera.target[0] + direction[0] * zoomFactor,
        prev.camera.target[1] + direction[1] * zoomFactor,
        prev.camera.target[2] + direction[2] * zoomFactor
      ]

      return {
        ...prev,
        camera: {
          ...prev.camera,
          position: newCameraPos
        },
        uniforms: {
          ...prev.uniforms,
          cameraPos: newCameraPos
        }
      }
    })
  }, [])

  // Render frame
  const render = useCallback(() => {
    const gl = glRef.current
    const shaderManager = shaderManagerRef.current
    if (!gl || !shaderManager) return

    const currentTime = (Date.now() - startTimeRef.current) / 1000

    setState(prevState => {
      const updatedUniforms = {
        ...prevState.uniforms,
        time: prevState.isPlaying ? currentTime : prevState.uniforms.time || 0
      }

      try {
        gl.clearColor(0, 0, 0, 1)
        gl.clear(gl.COLOR_BUFFER_BIT)

        shaderManager.useProgram(prevState.currentScene)
        shaderManager.setUniforms(prevState.currentScene, updatedUniforms)

        const program = shaderManager.useProgram(prevState.currentScene)
        const positionLocation = gl.getAttribLocation(program, 'a_position')

        if (positionLocation !== -1) {
          gl.enableVertexAttribArray(positionLocation)
          gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
        }

        return { ...prevState, uniforms: updatedUniforms }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Render failed')
        return prevState
      }
    })
  }, [])

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

  // Initialize on mount
  useEffect(() => {
    if (initializeGL()) {
      loadScene('basic-sphere')
    }

    return () => {
      if (shaderManagerRef.current) {
        shaderManagerRef.current.dispose()
      }
    }
  }, [initializeGL, loadScene])

  // Reset camera for current scene
  const resetCamera = useCallback(() => {
    const scene = scenePresets.find(s => s.id === state.currentScene)
    if (!scene) return

    const defaultCamera = {
      position: scene.defaultUniforms.cameraPos as [number, number, number] || [0, 0, 5],
      target: scene.defaultUniforms.cameraTarget as [number, number, number] || [0, 0, 0],
      fov: scene.defaultUniforms.fov as number || 45
    }

    setState(prev => ({
      ...prev,
      camera: defaultCamera,
      uniforms: {
        ...prev.uniforms,
        cameraPos: defaultCamera.position,
        cameraTarget: defaultCamera.target,
        fov: defaultCamera.fov
      }
    }))
  }, [state.currentScene, scenePresets])

  return (
    <div className={`raymarching-renderer ${className}`}>
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="border border-gray-600 cursor-grab active:cursor-grabbing rounded"
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          onWheel={handleWheel}
        />

        {error && (
          <div className="absolute top-2 left-2 bg-red-500 text-white px-3 py-1 rounded text-sm">
            {error}
          </div>
        )}

        <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-3 py-1 rounded text-sm">
          Drag to rotate • Scroll to zoom
        </div>
      </div>

      {state.showControls && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={() => setState(prev => ({ ...prev, isPlaying: !prev.isPlaying }))}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
              {state.isPlaying ? 'Pause' : 'Play'}
            </button>

            <select
              value={state.currentScene}
              onChange={(e) => loadScene(e.target.value)}
              className="px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {scenePresets.map(scene => (
                <option key={scene.id} value={scene.id} className="bg-gray-800 text-white">
                  {scene.name}
                </option>
              ))}
            </select>

            <button
              onClick={resetCamera}
              className="px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded hover:bg-gray-700 transition-colors">
              Reset Camera
            </button>

            <button
              onClick={() => setState(prev => ({ ...prev, showControls: !prev.showControls }))}
              className="px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded hover:bg-gray-700 transition-colors">
              Hide Controls
            </button>
          </div>

          <div className="text-sm text-gray-300 space-y-1">
            <p>
              Current: {scenePresets.find(s => s.id === state.currentScene)?.description}
            </p>
            <p>Time: {state.uniforms.time?.toFixed(2)}s</p>
            <p>
              Camera: [{state.camera.position.map(v => v.toFixed(1)).join(', ')}]
            </p>
            <p>FOV: {state.camera.fov}°</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default RaymarchingRenderer
