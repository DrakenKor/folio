const CELL = 20
const RADIUS = 7

interface AvalancheWallProps {
  // One entry per digest bit: 1 is a filled diamond, 0 an outline
  bits: Uint8Array
  // 1 where the bit changed in the last edit; null for no flash
  changed: Uint8Array | null
  // Alternates each edit so the flash animation restarts
  generation: number
  label: string
}

/** The digest as a wall of diamonds, 16 wide for 256 bits and 8 wide for 32. */
export function AvalancheWall({ bits, changed, generation, label }: AvalancheWallProps) {
  const columns = bits.length > 32 ? 16 : 8
  const rows = bits.length / columns
  const flash = generation % 2 ? 'a' : 'b'
  return (
    <svg
      className="crypto-wall"
      viewBox={`0 0 ${columns * CELL} ${rows * CELL}`}
      role="img"
      aria-label={`${label}: ${bits.length} bits, a filled diamond for each 1 and an outline for each 0`}>
      {Array.from(bits, (bit, index) => {
        const x = (index % columns) * CELL + CELL / 2
        const y = Math.floor(index / columns) * CELL + CELL / 2
        return (
          <polygon
            key={index}
            className="crypto-bit"
            data-on={bit}
            data-flash={changed?.[index] ? flash : undefined}
            points={`${x},${y - RADIUS} ${x + RADIUS},${y} ${x},${y + RADIUS} ${x - RADIUS},${y}`}
          />
        )
      })}
    </svg>
  )
}
