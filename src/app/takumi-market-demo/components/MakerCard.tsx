'use client'

import { Maker } from '../types'
import { DemoImage } from './shared'
import styles from '../takumi-market.module.css'

export function MakerCard({ maker, onOpen }: { maker: Maker; onOpen: (makerId: string) => void }) {
  return (
    <article className={styles.makerCard}>
      <button type="button" className={styles.makerCardButton} onClick={() => onOpen(maker.id)}>
        <DemoImage src={maker.heroImage.url} alt={maker.heroImage.alt} className={styles.makerCardImage} />
        <div className={styles.makerCardBody}>
          <p className={styles.eyebrow}>{maker.craft}</p>
          <h3 className={styles.makerCardTitle}>{maker.name}</h3>
          <p className={styles.makerCardLocation}>{maker.location}</p>
          <p className={styles.makerCardQuote}>“{maker.quote}”</p>
        </div>
      </button>
    </article>
  )
}

