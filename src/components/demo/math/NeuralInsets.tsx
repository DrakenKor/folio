'use client'

import { DIAGRAM, NeuralNetworkPlayground } from '@/lib/math-visualization/NeuralNetworkPlayground'

const { width: WIDTH, height: HEIGHT } = DIAGRAM

/**
 * The network as nodes and lines. A line is as heavy as its weight is large.
 * Pointing at a neuron, or focusing it, puts that neuron's output on the stage.
 */
export function NetworkDiagram({ exhibit }: { exhibit: NeuralNetworkPlayground }) {
  const { layers, weights, probe } = exhibit.getDiagram()
  const slot = exhibit.getInsetSlot()
  const x = (layer: number) => 18 + (layer * (WIDTH - 36)) / (layers.length - 1)
  const y = (layer: number, index: number) => HEIGHT / 2 + (index - (layers[layer] - 1) / 2) * Math.min(19, (HEIGHT - 24) / layers[layer])

  return (
    <div className="math-diagram demo-chrome" style={{ left: slot.x, top: slot.y, width: slot.width, height: slot.height }}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label="Network diagram. Focus a neuron to see its output on the stage.">
        {weights.map((layer, l) =>
          Array.from(layer, (weight, k) => {
            const from = k % layers[l]
            const to = Math.floor(k / layers[l])
            return (
              <line
                key={`${l}-${k}`}
                x1={x(l)}
                y1={y(l, from)}
                x2={x(l + 1)}
                y2={y(l + 1, to)}
                strokeWidth={Math.min(4, Math.max(0.3, Math.abs(weight) * 1.1))}
              />
            )
          })
        )}
        {layers.map((count, l) =>
          Array.from({ length: count }, (_, index) => {
            const show = () => exhibit.setProbe({ layer: l, index })
            const hide = () => exhibit.setProbe(null)
            return (
              <g
                key={`${l}-${index}`}
                role="button"
                tabIndex={0}
                aria-label={l === 0 ? `Input ${index === 0 ? 'x' : 'y'}` : `Layer ${l}, neuron ${index + 1}`}
                data-lit={probe?.layer === l && probe.index === index ? 'true' : 'false'}
                onPointerEnter={show}
                onPointerLeave={hide}
                onFocus={show}
                onBlur={hide}>
                <circle cx={x(l)} cy={y(l, index)} r={9} className="math-diagram-target" />
                <circle cx={x(l)} cy={y(l, index)} r={5} />
              </g>
            )
          })
        )}
      </svg>
    </div>
  )
}

// Loss against step on a log scale, drawn as one line. No chart library.
export function LossChart({ exhibit }: { exhibit: NeuralNetworkPlayground }) {
  const history = exhibit.getHistory().filter(point => point.loss > 0 && Number.isFinite(point.loss))
  if (history.length < 2) {
    return (
      <div className="math-loss">
        <p>
          <span className="demo-key">Loss</span> press Train to draw the curve
        </p>
      </div>
    )
  }
  const logs = history.map(point => Math.log10(point.loss))
  const top = Math.max(...logs)
  const bottom = Math.min(...logs)
  const first = history[0].step
  const span = history[history.length - 1].step - first || 1
  const points = history
    .map((point, i) => `${(((point.step - first) / span) * 100).toFixed(2)},${(2 + ((top - logs[i]) / (top - bottom || 1)) * 36).toFixed(2)}`)
    .join(' ')
  const label = (value: number) => Math.pow(10, value).toPrecision(1)

  return (
    <div className="math-loss">
      <p>
        <span className="demo-key">Loss</span> against step, log scale
      </p>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label={`Loss has gone from ${label(logs[0])} to ${label(logs[logs.length - 1])}`}>
        <polyline points={points} vectorEffect="non-scaling-stroke" />
      </svg>
      <p className="math-loss-range">
        <span>high {label(top)}</span>
        <span>low {label(bottom)}</span>
      </p>
    </div>
  )
}
