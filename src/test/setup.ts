import '@testing-library/jest-dom'

// Mock Three.js for testing
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Mock WebGL context
const mockWebGLContext = {
  canvas: {},
  drawingBufferWidth: 1024,
  drawingBufferHeight: 768,
  getExtension: () => null,
  getParameter: () => null,
  createShader: () => ({}),
  shaderSource: () => {},
  compileShader: () => {},
  createProgram: () => ({}),
  attachShader: () => {},
  linkProgram: () => {},
  useProgram: () => {},
  createBuffer: () => ({}),
  bindBuffer: () => {},
  bufferData: () => {},
  enableVertexAttribArray: () => {},
  vertexAttribPointer: () => {},
  drawArrays: () => {},
  clear: () => {},
  clearColor: () => {},
  enable: () => {},
  disable: () => {},
  viewport: () => {},
}

HTMLCanvasElement.prototype.getContext = function(contextId: string) {
  if (contextId === 'webgl' || contextId === 'webgl2') {
    return mockWebGLContext
  }
  return null
}
