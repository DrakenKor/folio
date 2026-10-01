'use client'

import { useState } from 'react'
import { useIsPhone } from '@/components/demo/Rail'
import { Placard as PlacardText } from '@/types/math-visualization'

/**
 * The wall label beside an exhibit: its title, its formula and two sentences.
 * On a phone the sentences start folded away, so the exhibit keeps the room.
 */
export function Placard({ title, formula, text, note }: PlacardText) {
  const phone = useIsPhone()
  // null until the visitor folds or unfolds it themselves
  const [chosen, setChosen] = useState<boolean | null>(null)
  const open = chosen ?? !phone

  return (
    <div className="math-placard">
      <details open={open}>
        <summary
          onClick={event => {
            event.preventDefault()
            setChosen(!open)
          }}>
          <h2>{title}</h2>
          <span className="math-placard-formula">{formula}</span>
          <span className="math-placard-fold">{open ? 'Less' : 'More'}</span>
        </summary>
        <p>{text}</p>
      </details>
      {note && (
        <p className="math-placard-note" role="status">
          {note}
        </p>
      )}
    </div>
  )
}
