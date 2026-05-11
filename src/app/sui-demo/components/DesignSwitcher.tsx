'use client'

import { designs } from '../data'
import type { DesignId } from '../types'
import styles from '../sui-demo.module.css'

interface DesignSwitcherProps {
  activeDesign: DesignId
  onChange: (design: DesignId) => void
}

export function DesignSwitcher({ activeDesign, onChange }: DesignSwitcherProps) {
  return (
    <div className={styles.designSwitcher} aria-label="Design switcher">
      {designs.map((design) => (
        <button
          key={design.id}
          type="button"
          className={`${styles.designOption} ${activeDesign === design.id ? styles.designOptionActive : ''}`}
          aria-pressed={activeDesign === design.id}
          onClick={() => onChange(design.id)}>
          <span className={styles.designOptionText}>{design.shortLabel}</span>
        </button>
      ))}
    </div>
  )
}
