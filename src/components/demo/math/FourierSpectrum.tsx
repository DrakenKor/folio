'use client'

import { PointerEvent } from 'react'
import { FourierVisualizer } from '@/lib/math-visualization/FourierVisualizer'

/**
 * One bar per frequency, lowest on the left, as tall as the square root of
 * its circle's size. Hovering a bar lights its circle on the stage, and
 * hovering a circle lights its bar here.
 */
export function FourierSpectrum({ exhibit }: { exhibit: FourierVisualizer }) {
  const bars = exhibit.getSpectrum()
  if (!bars.length) return null
  const used = bars.filter(bar => bar.used).length
  const lit = bars.find(bar => bar.lit)

  const onMove = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const index = Math.min(bars.length - 1, Math.max(0, Math.floor(((event.clientX - box.left) / box.width) * bars.length)))
    exhibit.setHighlight(bars[index].used ? bars[index].frequency : null)
  }

  return (
    <div className="math-spectrum">
      <svg
        viewBox={`0 0 ${bars.length} 40`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Spectrum: the size of each circle by frequency, ${used} of ${bars.length} in use`}
        onPointerMove={onMove}
        onPointerLeave={() => exhibit.setHighlight(null)}>
        {bars.map((bar, index) => (
          <rect
            key={bar.frequency}
            x={index + 0.1}
            y={40 - Math.max(0.6, bar.height * 40)}
            width={0.8}
            height={Math.max(0.6, bar.height * 40)}
            data-used={bar.used ? 'true' : 'false'}
            data-lit={bar.lit ? 'true' : 'false'}
          />
        ))}
      </svg>
      <p>
        <span className="demo-key">Spectrum</span>{' '}
        {lit
          ? `${Math.abs(lit.frequency)} ${Math.abs(lit.frequency) === 1 ? 'turn' : 'turns'} a lap, ${lit.frequency > 0 ? 'clockwise' : 'anticlockwise'}`
          : `${used} of ${bars.length} circles`}
      </p>
    </div>
  )
}
