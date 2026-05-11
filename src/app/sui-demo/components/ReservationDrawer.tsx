'use client'

import Image from 'next/image'
import { useRef, useState } from 'react'
import { FiCheck, FiCopy, FiInstagram, FiMapPin, FiMessageCircle, FiPlus, FiX } from 'react-icons/fi'
import { assets, options, salon } from '../data'
import type { ContactMethod, OptionId, SalonOption, SalonService } from '../types'
import { formatYen } from '../utils'
import styles from '../sui-demo.module.css'
import { useBodyScrollLock, useEscape, useFocusTrap } from './dialog-hooks'

interface ReservationDrawerProps {
  open: boolean
  service: SalonService
  selectedOptions: SalonOption[]
  selectedOptionIds: OptionId[]
  totalDuration: number
  totalPrice: number
  contactMethod: ContactMethod
  recommendationNote: string
  onContactMethodChange: (method: ContactMethod) => void
  onToggleOption: (option: OptionId) => void
  onCopy: (value: string, label: string) => void
  onClose: () => void
}

const contactMethods: ContactMethod[] = ['LINE', 'Instagram', 'Access']

export function ReservationDrawer({
  open,
  service,
  selectedOptions,
  selectedOptionIds,
  totalDuration,
  totalPrice,
  contactMethod,
  recommendationNote,
  onContactMethodChange,
  onToggleOption,
  onCopy,
  onClose
}: ReservationDrawerProps) {
  const [expandedImage, setExpandedImage] = useState(false)
  const panelRef = useRef<HTMLDivElement | null>(null)

  useBodyScrollLock(open)
  useEscape(open, onClose)
  useFocusTrap(panelRef, open)

  if (!open) {
    return null
  }

  return (
    <div className={styles.drawerOverlay}>
      <button type="button" className={styles.overlayBackdrop} aria-label="予約パネルを閉じる" onClick={onClose} />
      <aside className={styles.reservationDrawer} ref={panelRef} role="dialog" aria-modal="true" aria-label="ご予約・ご相談">
        <div className={styles.drawerHandle} />
        <div className={styles.drawerHeader}>
          <div>
            <h2>ご予約・ご相談</h2>
          </div>
          <button type="button" className={styles.iconButton} aria-label="予約パネルを閉じる" onClick={onClose}>
            <FiX aria-hidden />
          </button>
        </div>

        <div className={styles.drawerBody}>
          <section className={styles.drawerSummary}>
            <p className={styles.recommendationNote}>{recommendationNote}</p>
            <h3>{service.name}</h3>
            <p>{service.ingredient}</p>
            <div className={styles.selectedOptions}>
              {selectedOptions.length > 0 ? selectedOptions.map((option) => <span key={option.id}>＋{option.name}</span>) : <span>オプションなし</span>}
            </div>
            <div className={styles.totalRow}>
              <span>合計</span>
              <strong>
                {totalDuration}分 / {formatYen(totalPrice)}
              </strong>
            </div>
          </section>

          <section className={styles.drawerSection}>
            <h3>Options</h3>
            <div className={styles.drawerOptions}>
              {options.map((option) => {
                const selected = selectedOptionIds.includes(option.id)
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`${styles.optionToggle} ${selected ? styles.optionToggleActive : ''}`}
                    aria-pressed={selected}
                    onClick={() => onToggleOption(option.id)}>
                    <span>{selected ? <FiCheck aria-hidden /> : <FiPlus aria-hidden />}</span>
                    <strong>{option.name}</strong>
                    <small>
                      {option.duration} / {option.price}
                    </small>
                  </button>
                )
              })}
            </div>
          </section>

          <section className={styles.drawerSection}>
            <h3>Contact</h3>
            <div className={styles.contactTabs} role="tablist" aria-label="お問い合わせ方法">
              {contactMethods.map((method) => (
                <button
                  key={method}
                  type="button"
                  role="tab"
                  aria-selected={contactMethod === method}
                  className={contactMethod === method ? styles.contactTabActive : ''}
                  onClick={() => onContactMethodChange(method)}>
                  {method}
                </button>
              ))}
            </div>

            <div className={styles.contactMethodPanel}>
              {contactMethod === 'LINE' ? (
                <>
                  <p>
                    <FiMessageCircle aria-hidden />
                    LINE QRからお問い合わせください。
                  </p>
                  <QrCard onExpand={() => setExpandedImage(true)} />
                </>
              ) : null}
              {contactMethod === 'Instagram' ? (
                <>
                  <p>
                    <FiInstagram aria-hidden />
                    {salon.instagram}
                    <button type="button" aria-label="Instagram IDをコピー" onClick={() => onCopy(salon.instagram, 'Instagram ID')}>
                      <FiCopy aria-hidden />
                    </button>
                  </p>
                  <QrCard onExpand={() => setExpandedImage(true)} />
                </>
              ) : null}
              {contactMethod === 'Access' ? (
                <>
                  <p>
                    <FiMapPin aria-hidden />
                    {salon.address}
                    <button type="button" aria-label="住所をコピー" onClick={() => onCopy(salon.address, '住所')}>
                      <FiCopy aria-hidden />
                    </button>
                  </p>
                  <p>
                    {salon.appointment} / OPEN {salon.hours}
                  </p>
                  <QrCard onExpand={() => setExpandedImage(true)} />
                </>
              ) : null}
            </div>
          </section>

          <p className={styles.drawerFinePrint}>ご相談だけでも歓迎です。お気軽にお問い合わせください。</p>
        </div>
      </aside>

      {expandedImage ? (
        <div className={styles.imageZoomOverlay} role="dialog" aria-modal="true" aria-label="QRとアクセスカード拡大表示">
          <button type="button" className={styles.overlayBackdrop} aria-label="拡大画像を閉じる" onClick={() => setExpandedImage(false)} />
          <div className={styles.imageZoomPanel}>
            <button type="button" className={styles.iconButton} aria-label="拡大画像を閉じる" onClick={() => setExpandedImage(false)}>
              <FiX aria-hidden />
            </button>
            <Image src={assets.accessCard} alt="Instagram QR、LINE QR、アクセス地図が載ったカード" width={600} height={1050} />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function QrCard({ onExpand }: { onExpand: () => void }) {
  return (
    <button type="button" className={styles.drawerQrCard} onClick={onExpand} aria-label="QRとアクセスカードを拡大表示">
      <Image src={assets.accessCard} alt="Instagram QR、LINE QR、アクセス地図が載ったカード" width={600} height={1050} />
      <span>拡大して見る</span>
    </button>
  )
}
