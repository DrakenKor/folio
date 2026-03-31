export interface CanvasDimensions {
  width: number
  height: number
}

interface PointerPositionOptions {
  flipY?: boolean
}

export function syncCanvasToDisplaySize(
  canvas: HTMLCanvasElement,
  gl?: WebGLRenderingContext | null,
  fallbackDimensions?: CanvasDimensions
): CanvasDimensions {
  const rect = canvas.getBoundingClientRect()
  const devicePixelRatio =
    typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1

  const width = Math.max(
    1,
    Math.round(
      (rect.width || fallbackDimensions?.width || canvas.width || 1) *
        devicePixelRatio
    )
  )
  const height = Math.max(
    1,
    Math.round(
      (rect.height || fallbackDimensions?.height || canvas.height || 1) *
        devicePixelRatio
    )
  )

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }

  gl?.viewport(0, 0, width, height)

  return { width, height }
}

export function getCanvasPointerPosition(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  options: PointerPositionOptions = {}
): [number, number] {
  const rect = canvas.getBoundingClientRect()
  const scaleX = rect.width > 0 ? canvas.width / rect.width : 1
  const scaleY = rect.height > 0 ? canvas.height / rect.height : 1

  const x = (clientX - rect.left) * scaleX
  const y = (clientY - rect.top) * scaleY

  return [x, options.flipY ? canvas.height - y : y]
}
