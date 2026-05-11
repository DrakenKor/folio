'use client'

import { FiChevronDown, FiChevronUp, FiClock, FiDroplet, FiStar } from 'react-icons/fi'
import type { SalonOption, SalonService } from '../types'
import styles from '../sui-demo.module.css'

interface ServiceCardProps {
  service: SalonService
  index: number
  recommended: boolean
  selected: boolean
  expanded: boolean
  suggestedOption?: SalonOption
  variant?: 'poster' | 'poster-static' | 'spa' | 'spa-horizontal' | 'compact'
  onToggle: () => void
  onSelect: () => void
  onReserve: () => void
}

export function ServiceCard({
  service,
  index,
  recommended,
  selected,
  expanded,
  suggestedOption,
  variant = 'poster',
  onToggle,
  onSelect,
  onReserve
}: ServiceCardProps) {
  if (variant === 'poster-static') {
    return (
      <article className={`${styles.serviceRow} ${recommended ? styles.serviceRowRecommended : ''}`}>
        <span className={styles.serviceRowNumber}>{String(index + 1).padStart(2, '0')}</span>
        <div className={styles.serviceRowBody}>
          <strong>{service.name}</strong>
          <small>{service.ingredient}</small>
          <p>{service.description}</p>
        </div>
        <div className={styles.serviceRowMeta}>
          <span>{service.duration}</span>
          <strong>{service.price}</strong>
        </div>
        <button type="button" className={styles.primaryButton} onClick={onReserve}>
          予約
        </button>
      </article>
    )
  }

  if (variant === 'spa-horizontal') {
    return (
      <article className={`${styles.spaCard} ${recommended ? styles.spaCardRecommended : ''}`}>
        <span className={styles.spaIllustrationWell} aria-hidden>
          {service.id === 'hand-care' ? <FiStar /> : <FiDroplet />}
        </span>
        <div className={styles.spaCardBody}>
          <strong>{service.name}</strong>
          <small>{service.ingredient}</small>
          <p>{service.description}</p>
        </div>
        <div className={styles.spaCardMeta}>
          <span>{service.duration}</span>
          <strong>{service.price}</strong>
          <button type="button" className={styles.primaryButton} onClick={onReserve}>
            予約
          </button>
        </div>
      </article>
    )
  }

  return (
    <article
      className={`${styles.serviceCard} ${styles[`serviceCard${capitalize(variant)}`]} ${recommended ? styles.serviceCardRecommended : ''} ${
        selected ? styles.serviceCardSelected : ''
      }`}>
      <button type="button" className={styles.serviceMain} aria-expanded={expanded} onClick={onToggle}>
        <span className={styles.serviceNumber}>{String(index + 1).padStart(2, '0')}</span>
        <span className={styles.serviceIcon} aria-hidden>
          {service.id === 'hand-care' ? <FiStar /> : <FiDroplet />}
        </span>
        <span className={styles.serviceCopy}>
          <strong>{service.name}</strong>
          <small>{service.ingredient}</small>
        </span>
        <span className={styles.serviceMeta}>
          <span>
            <FiClock aria-hidden />
            {service.duration}
          </span>
          <strong>{service.price}</strong>
        </span>
        <span className={styles.serviceChevron} aria-hidden>
          {expanded ? <FiChevronUp /> : <FiChevronDown />}
        </span>
      </button>

      {expanded ? (
        <div className={styles.serviceDetail}>
          <p>{service.description}</p>
          <div className={styles.serviceDetailGrid}>
            <span>向いているお悩み: {service.idealConcerns.join(' / ')}</span>
            <span>おすすめ: {suggestedOption ? suggestedOption.name : '単品でもご予約いただけます'}</span>
          </div>
          <div className={styles.serviceActions}>
            <button type="button" className={styles.textButton} onClick={onSelect}>
              このコースを選ぶ
            </button>
            <button type="button" className={styles.primaryButton} onClick={onReserve}>
              予約・相談する
            </button>
          </div>
        </div>
      ) : null}
    </article>
  )
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
