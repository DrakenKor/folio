'use client'

import { FiCalendar, FiClock, FiMapPin } from 'react-icons/fi'
import { trustPoints } from '../data'
import styles from '../sui-demo.module.css'

const icons = [FiCalendar, FiMapPin, FiClock]

export function TrustStrip() {
  return (
    <section className={styles.trustStrip} aria-label="サロンの特徴">
      {trustPoints.map((point, index) => {
        const Icon = icons[index]
        return (
          <div key={point.label} className={styles.trustItem}>
            <span className={styles.trustIcon} aria-hidden>
              <Icon />
            </span>
            <span>{point.label}</span>
            <small>{point.detail}</small>
          </div>
        )
      })}
    </section>
  )
}
