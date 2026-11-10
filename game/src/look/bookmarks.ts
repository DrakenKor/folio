// Fixed camera bookmarks for the look spike, placed relative to the seeded
// layout so they frame the same things for any seed.
import type { Heightfield } from '../render/terrain/heightfield'

export type BookmarkName = 'wide' | 'player' | 'monolith'

export interface Bookmark {
  position: [number, number, number]
  target: [number, number, number]
  fov: number
  /** Ground point the grass field and shadow map centre on. */
  focus: [number, number]
  /** Half-size of the shadow map's coverage, in metres. */
  shadowExtent: number
  /** Grass cell size: wider views spread the blades over more ground. */
  grassCell: number
}

export function bookmark(name: BookmarkName, field: Heightfield): Bookmark {
  const { player, monolith } = field
  const ground = (x: number, z: number) => field.heightAt(x, z)
  switch (name) {
    case 'player': {
      // The game camera: three-quarter top-down, 55° pitch.
      const pitch = (55 * Math.PI) / 180
      const yaw = (20 * Math.PI) / 180
      const dist = 17
      const y = ground(player.x, player.z) + 0.9
      return {
        position: [
          player.x + Math.sin(yaw) * Math.cos(pitch) * dist,
          y + Math.sin(pitch) * dist,
          player.z + Math.cos(yaw) * Math.cos(pitch) * dist
        ],
        target: [player.x, y, player.z],
        fov: 40,
        focus: [player.x, player.z - 2],
        shadowExtent: 28,
        grassCell: 0.2
      }
    }
    case 'monolith': {
      const cx = monolith.x - 14
      const cz = monolith.z + 15
      return {
        position: [cx, ground(cx, cz) + 2.4, cz],
        target: [monolith.x, monolith.y + 4.2, monolith.z],
        fov: 46,
        focus: [cx + (monolith.x - cx) * 0.55, cz + (monolith.z - cz) * 0.55],
        shadowExtent: 40,
        grassCell: 0.24
      }
    }
    case 'wide':
    default: {
      const cx = player.x - 34
      const cz = player.z + 52
      return {
        position: [cx, ground(cx, cz) + 14, cz],
        target: [monolith.x - 2, monolith.y + 3, monolith.z],
        fov: 48,
        focus: [cx + 34, cz - 44],
        shadowExtent: 80,
        grassCell: 0.34
      }
    }
  }
}
