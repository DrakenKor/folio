import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, RGBAFormat, UnsignedByteType } from 'three/webgpu'
import { rng, subSeed } from '../rng'

export function createGrassPaint(seed: number): DataTexture {
  const size = 512
  const data = new Uint8Array(size * size * 4)
  const random = rng(subSeed(seed, 'grass-paint'))
  for (let index = 3; index < data.length; index += 4) data[index] = 255
  for (let stroke = 0; stroke < 2600; stroke++) {
    const rootX = random() * size
    const rootY = random() * size
    const height = 10 + random() * 25
    const width = 1.1 + random() * 1.8
    const lean = (random() - 0.5) * 12
    const light = 130 + random() * 125
    for (let row = 0; row < height; row++) {
      const progress = row / height
      const centre = rootX + lean * progress * progress
      const radius = width * (1 - progress)
      const y = (Math.floor(rootY + row) + size) % size
      for (let column = Math.floor(centre - radius - 1); column <= centre + radius + 1; column++) {
        const coverage = Math.min(1, Math.max(0, radius + 0.5 - Math.abs(column - centre)))
        const x = (column + size) % size
        const index = (y * size + x) * 4
        data[index] = Math.max(data[index]!, Math.round(coverage * (1 - progress) * 180))
        data[index + 1] = Math.max(data[index + 1]!, Math.round(coverage * progress * light))
      }
    }
  }
  const paint = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType)
  paint.wrapS = paint.wrapT = RepeatWrapping
  paint.magFilter = LinearFilter
  paint.minFilter = LinearMipmapLinearFilter
  paint.generateMipmaps = true
  paint.needsUpdate = true
  return paint
}
