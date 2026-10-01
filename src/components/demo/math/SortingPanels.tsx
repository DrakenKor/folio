'use client'

import { AlgorithmVisualizer } from '@/lib/math-visualization/AlgorithmVisualizer'

const number = (value: number) => value.toLocaleString('en-GB')
const ORDINALS = ['', '1st', '2nd', '3rd', '4th', '5th', '6th']

// The name and live counts over each panel of bars. The bars are on the canvas.
export function SortingPanels({ exhibit }: { exhibit: AlgorithmVisualizer }) {
  return (
    <div className="math-panels">
      {exhibit.getPanels().map(panel => (
        <div
          key={panel.id}
          className="math-panel"
          role="group"
          aria-label={`${panel.name} sort`}
          data-state={panel.state}
          data-input={panel.inputFingerprint}
          style={{ left: panel.x, top: panel.y, width: panel.width, height: panel.height }}>
          <p>
            <strong>{panel.name}</strong>
            <span>{panel.place ? `Finished ${ORDINALS[panel.place]}` : panel.state}</span>
          </p>
          <p>
            <span>
              <span className="demo-key">Comparisons</span> {number(panel.comparisons)}
            </span>
            <span>
              <span className="demo-key">Writes</span> {number(panel.writes)}
            </span>
          </p>
        </div>
      ))}
    </div>
  )
}

// Sound is opt-in. While it is on, this stays in view, even with the chrome hidden.
export function SortingMute({ exhibit }: { exhibit: AlgorithmVisualizer }) {
  if (exhibit.getParameter('sound') !== true) return null
  return (
    <button type="button" className="math-mute" onClick={() => exhibit.setParameter('sound', false)}>
      <span>Sound on. </span>Mute
    </button>
  )
}

// The race as a table, filled as panels finish
export function SortingResults({ exhibit }: { exhibit: AlgorithmVisualizer }) {
  const results = exhibit.getResults()
  if (!results.length) return <p>No algorithm has finished yet. Open the Sorting exhibit and start a race to fill this table.</p>
  return (
    <table className="math-results">
      <caption>The latest race, in finishing order</caption>
      <thead>
        <tr>
          <th scope="col">Place</th>
          <th scope="col">Algorithm</th>
          <th scope="col">Comparisons</th>
          <th scope="col">Writes</th>
        </tr>
      </thead>
      <tbody>
        {results.map(result => (
          <tr key={result.name}>
            <td>{ORDINALS[result.place]}</td>
            <th scope="row">{result.name}</th>
            <td>{number(result.comparisons)}</td>
            <td>{number(result.writes)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
