'use client'

import { concerns } from '../data'
import type { ConcernId, Recommendation } from '../types'
import styles from '../sui-demo.module.css'

interface ConcernSelectorProps {
  concern: ConcernId
  recommendation: Recommendation
  onSelect: (concern: ConcernId) => void
  compact?: boolean
}

export function ConcernSelector({ concern, recommendation, onSelect, compact = false }: ConcernSelectorProps) {
  return (
    <div className={`${styles.concernBlock} ${compact ? styles.concernBlockCompact : ''}`}>
      <div className={styles.concernHeader}>
        <p className={styles.eyebrow}>Concern</p>
        <h2>気になるお悩みを選ぶ</h2>
      </div>
      <div className={styles.concernPills} role="group" aria-label="肌のお悩み">
        {concerns.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`${styles.concernPill} ${concern === entry.id ? styles.concernPillActive : ''}`}
            aria-pressed={concern === entry.id}
            title={entry.hint}
            onClick={() => onSelect(entry.id)}>
            <span>{entry.label}</span>
            <small>{entry.hint}</small>
          </button>
        ))}
      </div>
      <p className={styles.recommendationNote} aria-live="polite">
        {recommendation.note}
      </p>
    </div>
  )
}
