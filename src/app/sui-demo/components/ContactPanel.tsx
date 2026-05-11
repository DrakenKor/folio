'use client'

import Image from 'next/image'
import { FiArrowRight, FiCopy, FiInstagram, FiMapPin, FiMessageCircle } from 'react-icons/fi'
import { assets, salon } from '../data'
import styles from '../sui-demo.module.css'

interface ContactPanelProps {
  variant?: 'poster' | 'soft' | 'studio' | 'concierge'
  onReserve: () => void
  onCopy: (value: string, label: string) => void
}

export function ContactPanel({ variant = 'poster', onReserve, onCopy }: ContactPanelProps) {
  return (
    <section className={`${styles.contactPanel} ${styles[`contactPanel${capitalize(variant)}`]}`} aria-label="予約とアクセス">
      <div className={styles.contactPrimary}>
        <p className={styles.eyebrow}>Reservation</p>
        <h2>LINEまたはInstagramからお問い合わせください。</h2>
        <p>ご相談だけでも歓迎です。お気軽にお問い合わせください。</p>
        <div className={styles.contactActions}>
          <button type="button" className={styles.primaryButton} onClick={onReserve}>
            <FiMessageCircle aria-hidden />
            予約・相談する
          </button>
        </div>
      </div>
      <div className={styles.qrPreview}>
        <Image src={assets.accessCard} alt="Instagram QR、LINE QR、アクセス地図が載ったカード" width={600} height={1050} />
      </div>
      <div className={styles.accessSummary}>
        <p>
          <FiInstagram aria-hidden />
          <span>{salon.instagram}</span>
          <button type="button" aria-label="Instagram IDをコピー" onClick={() => onCopy(salon.instagram, 'Instagram ID')}>
            <FiCopy aria-hidden />
          </button>
        </p>
        <p>
          <FiMapPin aria-hidden />
          <span>{salon.address}</span>
          <button type="button" aria-label="住所をコピー" onClick={() => onCopy(salon.address, '住所')}>
            <FiCopy aria-hidden />
          </button>
        </p>
        <p>
          <FiArrowRight aria-hidden />
          <span>{salon.appointment} / OPEN {salon.hours}</span>
        </p>
      </div>
    </section>
  )
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
