'use client'

import { useSearchParams } from 'next/navigation'
import { KeyboardEvent, useCallback, useState } from 'react'
import { Stage } from '@/components/demo/DemoShell'
import { Ledger } from '@/components/demo/Ledger'
import { Notes, NotesSection, NotesSource } from '@/components/demo/Notes'
import { Rail } from '@/components/demo/Rail'
import { AlgorithmVisualizer } from '@/lib/math-visualization/AlgorithmVisualizer'
import { FourierVisualizer } from '@/lib/math-visualization/FourierVisualizer'
import { FractalExplorer } from '@/lib/math-visualization/FractalExplorer'
import { GalleryManager } from '@/lib/math-visualization/GalleryManager'
import { NeuralNetworkPlayground } from '@/lib/math-visualization/NeuralNetworkPlayground'
import { ControlPanel } from './ControlPanel'
import { Corner, ExhibitHost, useExhibit } from './ExhibitHost'
import { FourierSpectrum } from './FourierSpectrum'
import { LossChart, NetworkDiagram } from './NeuralInsets'
import { Placard } from './Placard'
import { SortingMute, SortingPanels, SortingResults } from './SortingPanels'
import './math.css'

const createGallery = () => {
  const gallery = {
    manager: new GalleryManager(),
    fractal: new FractalExplorer(),
    fourier: new FourierVisualizer(),
    sorting: new AlgorithmVisualizer(),
    neural: new NeuralNetworkPlayground()
  }
  for (const exhibit of [gallery.fractal, gallery.fourier, gallery.sorting, gallery.neural]) {
    gallery.manager.registerVisualization(exhibit)
  }
  return gallery
}

/**
 * Four exhibits, one at a time, each filling the stage. The exhibit on show
 * is named in the URL as ?exhibit=fourier; the gallery opens on the fractal.
 */
export function MathGallery() {
  const search = useSearchParams()
  const [gallery] = useState(createGallery)
  const { manager, fractal, fourier, sorting, neural } = gallery
  const exhibits = manager.getAllVisualizations()
  const exhibit = manager.getVisualization(search.get('exhibit') ?? '') ?? fractal
  useExhibit(exhibit)
  // The sorting table in the notes follows the race whichever exhibit is up
  useExhibit(sorting)

  const [corner, setCorner] = useState<Corner>({ width: 0, height: 0 })
  const measureCorner = useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    const observer = new ResizeObserver(() => {
      const next = { width: node.offsetWidth, height: node.offsetHeight }
      setCorner(current => (current.width === next.width && current.height === next.height ? current : next))
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const show = (id: string) => {
    const path = window.location.pathname
    window.history.replaceState(null, '', id === fractal.id ? path : `${path}?exhibit=${id}`)
  }

  const onTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const next = exhibits[(exhibits.indexOf(exhibit) + step + exhibits.length) % exhibits.length]
    show(next.id)
    document.getElementById(`math-tab-${next.id}`)?.focus()
  }

  const inset = exhibit === fractal ? fractal.getInset() : null

  return (
    <>
      <Stage>
        <div className="math-tabs demo-chrome" role="tablist" aria-label="Exhibits" onKeyDown={onTabKey}>
          {exhibits.map(entry => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              id={`math-tab-${entry.id}`}
              aria-selected={entry === exhibit}
              aria-controls="math-stage"
              tabIndex={entry === exhibit ? 0 : -1}
              onClick={() => show(entry.id)}>
              {entry.name}
            </button>
          ))}
        </div>

        <ExhibitHost manager={manager} exhibit={exhibit} corner={corner} />

        <div className="math-overlay" key={exhibit.id}>
          {inset && (
            <div className="math-inset" style={{ left: inset.x, top: inset.y, width: inset.width, height: inset.height }}>
              <p>The Julia set for this point. Select it to step inside.</p>
            </div>
          )}
          {exhibit === sorting && <SortingPanels exhibit={sorting} />}
          {exhibit === sorting && <SortingMute exhibit={sorting} />}
          {exhibit === neural && <NetworkDiagram exhibit={neural} />}
        </div>

        <div className="math-corner demo-chrome" ref={measureCorner}>
          {exhibit === fourier && <FourierSpectrum exhibit={fourier} />}
          <div className="math-card">
            <Placard {...exhibit.getPlacard()} />
            <Ledger rows={exhibit.getLedger()} placement="inline" />
          </div>
        </div>
        <p id="math-description" className="demo-visually-hidden">
          {exhibit.describe()}
        </p>

        <Rail>
          <ControlPanel exhibit={exhibit} />
          {exhibit === neural && <LossChart exhibit={neural} />}
        </Rail>
      </Stage>

      <Notes slug="math">
        <NotesSection title="Fractal">
          <p>
            Take a point c. Start at zero, square it, add c, and repeat. If the result stays small forever, c is in the
            set and is drawn black. Otherwise the colour is how many steps it took to escape. Your graphics card does
            this for every pixel on every frame, in 32-bit floats, which run out of digits near 100,000x zoom. With the
            picture focused, the arrow keys pan and + and - zoom.
          </p>
          <p>
            <code>z → z² + c</code>
          </p>
        </NotesSection>
        <NotesSection title="Fourier">
          <p>
            A closed drawing is read as 512 complex numbers. A Fourier transform turns them into circles, each with a
            size, a starting angle and a whole number of turns per lap. Laid end to end, largest first, the last
            circle’s rim retraces the drawing. The strip above the placard shows every circle’s size by frequency, on
            a square-root scale. The portrait preset is the longest outline in this site’s portrait.
          </p>
          <p>
            <code>cₖ = (1/N) Σ zₙ e^(−2πikn/N)</code>
          </p>
        </NotesSection>
        <NotesSection title="Sorting">
          <p>
            Every algorithm gets the same array and takes the same number of steps a second, where a step is one
            comparison or one write. A bar is amber with a mark above it while it is compared, pink with a line to the
            top when it is written, and white with a tick beneath once it is in its final place. Quick sort here takes
            the last element as its pivot.
          </p>
          <SortingResults exhibit={sorting} />
          <p>
            <code>bubble, selection, insertion: about n²/2 comparisons. merge, quick, heap: about n log₂ n</code>
          </p>
        </NotesSection>
        <NotesSection title="Neural net">
          <p>
            The network takes a point and returns a number between 0 and 1. The stage shows that number on a 96 by 96
            grid: teal near 1, amber near 0, black near a half. Each training step takes 16 points, measures the squared
            error and nudges every weight downhill by backpropagation. In the diagram a line is as heavy as its weight
            is large, and pointing at a neuron shows what it alone has learned.
          </p>
          <p>
            <code>w ← w + η Σ δ a</code>
          </p>
        </NotesSection>
        <NotesSource
          files={[
            'src/components/demo/math/MathGallery.tsx',
            'src/components/demo/math/ExhibitHost.tsx',
            'src/shaders/fractal.glsl',
            'src/lib/math-visualization/FractalExplorer.ts',
            'src/lib/math-visualization/FourierVisualizer.ts',
            'src/lib/math-visualization/AlgorithmVisualizer.ts',
            'src/lib/math-visualization/NeuralNetworkPlayground.ts'
          ]}
        />
      </Notes>
    </>
  )
}
