// Independent geometric oracle; production topology is observed only through public operations.
export const neighbours = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]] as const
export const key = ([i, j]: readonly number[]) => `${i},${j}`
const rotate = ([i, j]: readonly number[]): [number, number] => [-j!, i! + j!]
export function rotation(point: readonly number[], turns: number): [number, number] {
  let result: [number, number] = [point[0]!, point[1]!]
  for (let n = 0; n < turns; n++) result = rotate(result)
  return result
}
export function legalVertices() {
  const removed = new Set<string>()
  for (let n = 0; n < 6; n++) for (const point of [[7, 0], [7, -1], [6, 1]]) removed.add(key(rotation(point, n)))
  const result: string[] = []
  for (let i = -7; i <= 7; i++) for (let j = -7; j <= 7; j++) if (Math.max(Math.abs(i), Math.abs(j), Math.abs(i + j)) <= 7 && !removed.has(`${i},${j}`)) result.push(`${i},${j}`)
  return result
}
export function route(node: string): string[] {
  const [i, j] = node.split(',').map(Number)
  const queue: Array<[number, number, string[]]> = [[0, 0, []]]; const seen = new Set(['0,0']); const legal = new Set(legalVertices())
  while (queue.length) {
    const [x, y, path] = queue.shift()!
    if (x === i && y === j) return path
    for (const [dx, dy] of neighbours) {
      const next = `${x + dx},${y + dy}`
      if (legal.has(next) && !seen.has(next)) { seen.add(next); queue.push([x + dx, y + dy, [...path, next]]) }
    }
  }
  return []
}
