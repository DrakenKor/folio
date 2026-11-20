import { sharedBuildView } from '../core/profile'
import type { CharacterState, GraphProfile, Operation, OperationReason, QueryResult, World } from '../core/types'

const ROOT = '0,0'
type Point = [number, number]
const directions: Point[] = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]]
type Shape = { id: string; perimeter: string[] }
type GraphEdit = Extract<Operation, { type: 'allocate' | 'refund' | 'activateShape' }>
export interface GraphTopology {
  vertices: { id: string; i: number; j: number }[]
  edges: [string, string][]
  shapes: Shape[]
}

function isVertex(i: number, j: number, radius: number) {
  const axes = [Math.abs(i), Math.abs(j), Math.abs(i + j)]
  const ring = Math.max(...axes)
  return ring < radius || (ring === radius && Math.min(...axes) > 1)
}

function neighbours(id: string) {
  const [i, j] = id.split(',').map(Number) as Point
  return directions.map(([di, dj]) => [i + di, j + dj].join(','))
}

function legalNode(id: string, radius: number) {
  const [i, j] = id.split(',').map(Number) as Point
  return Number.isInteger(i) && Number.isInteger(j) && id === [i, j].join(',') && isVertex(i, j, radius)
}

function rotateId(point: Point, turns: number) {
  let [i, j] = point
  for (let t = 0; t < turns; t++) [i, j] = [-j, i + j]
  return [i, j].join(',')
}

export function markedShapes(profile: GraphProfile): Shape[] {
  const rhombus: Point[] = [[0, 0], [1, 0], [1, 1], [0, 1]]
  const hexagon: Point[] = directions.map(([i, j]) => [3 + i, j])
  return profile.bargains.flatMap(({ orientation }) => [
    { id: 'rhombus-' + orientation, perimeter: rhombus.map(p => rotateId(p, orientation)) },
    { id: 'hexagon-' + orientation, perimeter: hexagon.map(p => rotateId(p, orientation)) }
  ])
}

/** Enumerate the player's lattice and marked boundaries in perimeter order; all arrays are detached. */
export function graphTopology(world: World): QueryResult<GraphTopology> {
  const { m2 } = sharedBuildView(world).content
  if (!m2) return { ok: false, reason: 'unsupported' }
  const graph = world.entities.find(e => e.id === world.playerId)?.character?.graph
  const profile = m2.graphProfiles.find(p => p.id === graph?.profileId && p.version === graph.version)
  if (!profile) return { ok: false, reason: 'no-player' }
  const vertices: GraphTopology['vertices'] = []
  const edges: GraphTopology['edges'] = []
  for (let i = -profile.radius; i <= profile.radius; i++) {
    for (let j = -profile.radius; j <= profile.radius; j++) {
      if (!isVertex(i, j, profile.radius)) continue
      const id = [i, j].join(',')
      vertices.push({ id, i, j })
      for (const [di, dj] of directions.slice(0, 3)) {
        if (isVertex(i + di, j + dj, profile.radius)) edges.push([id, [i + di, j + dj].join(',')])
      }
    }
  }
  return { ok: true, value: { vertices, edges, shapes: markedShapes(profile) } }
}

export function connectedNodes(allocations: string[], radius: number): Set<string> {
  const paid = new Set(allocations.filter(id => legalNode(id, radius)))
  const reached = new Set([ROOT])
  for (const id of reached) {
    for (const next of neighbours(id)) if (paid.has(next)) reached.add(next)
  }
  return reached
}

export function editGraph(character: CharacterState, profile: GraphProfile, edit: GraphEdit): OperationReason | null {
  const graph = character.graph
  if (edit.type === 'activateShape') {
    const shapes = markedShapes(profile)
    const shape = shapes.find(s => s.id === edit.shapeId)
    if (!shape) return 'unknown-shape'
    if (!edit.active) {
      graph.activeShapes = graph.activeShapes.filter(id => id !== shape.id)
      return null
    }
    if (graph.activeShapes.includes(shape.id)) return null
    const paid = shape.perimeter.filter(id => id !== ROOT)
    if (!paid.every(id => graph.allocations.includes(id))) return 'incomplete-shape'
    if (graph.activeShapes.length >= 2) return 'shape-limit'
    if (shapes.some(s => graph.activeShapes.includes(s.id) && s.perimeter.some(id => paid.includes(id)))) return 'shape-overlap'
    graph.activeShapes.push(shape.id)
    return null
  }
  const id = edit.nodeId
  if (!legalNode(id, profile.radius)) return 'unknown-node'
  if (edit.type === 'allocate') {
    if (id === ROOT || graph.allocations.includes(id)) return 'already-allocated'
    if (!neighbours(id).some(n => n === ROOT || graph.allocations.includes(n))) return 'not-connected'
    if (character.points === 0) return 'insufficient-points'
    graph.allocations.push(id)
    character.points--
    return null
  }
  if (!graph.allocations.includes(id)) return 'unknown-node'
  const kept = connectedNodes(graph.allocations.filter(n => n !== id), profile.radius)
  character.points += graph.allocations.length - (kept.size - 1)
  graph.allocations = graph.allocations.filter(n => kept.has(n))
  const complete = markedShapes(profile).filter(s => s.perimeter.every(n => kept.has(n)))
  graph.activeShapes = graph.activeShapes.filter(id => complete.some(s => s.id === id))
  return null
}

export function validateGraph(character: CharacterState, profile: GraphProfile): void {
  const graph = character.graph
  if (connectedNodes(graph.allocations, profile.radius).size !== graph.allocations.length + 1) {
    throw new TypeError('Invalid graph connectivity')
  }
  const candidate = { ...character, graph: { ...graph, activeShapes: [] as string[] } }
  for (const shapeId of graph.activeShapes) {
    const reason = editGraph(candidate, profile, { type: 'activateShape', shapeId, active: true })
    if (reason) throw new TypeError('Invalid saved shape: ' + reason)
  }
}
