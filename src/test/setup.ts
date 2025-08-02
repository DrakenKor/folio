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

// Mock 2D context
const mock2DContext = {
  clearRect: () => {},
  fillRect: () => {},
  strokeRect: () => {},
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  arc: () => {},
  stroke: () => {},
  fill: () => {},
  save: () => {},
  restore: () => {},
  translate: () => {},
  rotate: () => {},
  scale: () => {},
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  font: '',
  textAlign: 'start',
  textBaseline: 'alphabetic',
  globalAlpha: 1,
  globalCompositeOperation: 'source-over',
  canvas: {},
  fillText: () => {},
  strokeText: () => {},
  measureText: () => ({ width: 0 }),
  createLinearGradient: () => ({}),
  createRadialGradient: () => ({}),
  createPattern: () => null,
  getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
  putImageData: () => {},
  drawImage: () => {},
  setTransform: () => {},
  transform: () => {},
  resetTransform: () => {},
  clip: () => {},
  isPointInPath: () => false,
  isPointInStroke: () => false,
  getLineDash: () => [],
  setLineDash: () => {},
  lineDashOffset: 0,
  shadowBlur: 0,
  shadowColor: '',
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  lineCap: 'butt',
  lineJoin: 'miter',
  miterLimit: 10,
  closePath: () => {},
  quadraticCurveTo: () => {},
  bezierCurveTo: () => {},
  arcTo: () => {},
  rect: () => {},
  ellipse: () => {},
}

HTMLCanvasElement.prototype.getContext = function(contextId: string) {
  if (contextId === 'webgl' || contextId === 'webgl2') {
    return mockWebGLContext
  }
  if (contextId === '2d') {
    return mock2DContext as any
  }
  return null
}
