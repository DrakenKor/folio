'use client'

import { Button, Segmented } from '@/components/demo/controls'

export interface KernelState {
  size: 3 | 5
  // Text, so a half-typed "-" or "1." is not rewritten under the cursor
  cells: string[]
  divisor: string
}

export const toNumber = (text: string) => {
  const value = Number(text)
  return text.trim() !== '' && Number.isFinite(value) ? value : 0
}

export const kernelOf = (state: KernelState) => ({
  kernel: state.cells.map(toNumber),
  ksize: state.size,
  divisor: state.divisor.trim() === '' || !Number.isFinite(Number(state.divisor)) ? 1 : Number(state.divisor)
})

// A kernel of another size, centred, zero-padded or cropped
export function resize(state: KernelState, size: 3 | 5): KernelState {
  if (size === state.size) return state
  const cells: string[] = []
  const shift = (5 - 3) / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sy = size === 5 ? y - shift : y + shift
      const sx = size === 5 ? x - shift : x + shift
      const inside = sy >= 0 && sy < state.size && sx >= 0 && sx < state.size
      cells.push(inside ? state.cells[sy * state.size + sx] : '0')
    }
  }
  return { ...state, size, cells }
}

interface KernelGridProps {
  state: KernelState
  onChange: (state: KernelState) => void
  caption: string
}

export function KernelGrid({ state, onChange, caption }: KernelGridProps) {
  const sum = state.cells.reduce((total, cell) => total + toNumber(cell), 0)
  return (
    <fieldset className="demo-field image-kernel">
      <legend>Kernel</legend>
      <Segmented
        label="Grid size"
        value={state.size}
        options={[
          { value: 3, label: '3x3' },
          { value: 5, label: '5x5' }
        ]}
        onChange={size => onChange(resize(state, size))}
      />
      <div className="image-kernel-grid" style={{ gridTemplateColumns: `repeat(${state.size}, 1fr)` }}>
        {state.cells.map((cell, i) => (
          <input
            key={i}
            type="text"
            inputMode="decimal"
            value={cell}
            aria-label={`Kernel row ${Math.floor(i / state.size) + 1}, column ${(i % state.size) + 1}`}
            aria-invalid={cell.trim() === '' || !Number.isFinite(Number(cell))}
            onChange={event => onChange({ ...state, cells: state.cells.map((c, j) => (j === i ? event.target.value : c)) })}
          />
        ))}
      </div>
      <div className="image-kernel-divisor">
        <label>
          <span>Divisor</span>
          <input
            type="text"
            inputMode="decimal"
            value={state.divisor}
            onChange={event => onChange({ ...state, divisor: event.target.value })}
          />
        </label>
        <Button onClick={() => onChange({ ...state, divisor: String(sum === 0 ? 1 : sum) })}>Normalise</Button>
      </div>
      <p className="image-kernel-caption">{caption}</p>
    </fieldset>
  )
}
