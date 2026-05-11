'use client'

import Image from 'next/image'
import { useRef, useState } from 'react'
import { FiX } from 'react-icons/fi'
import { assets } from '../data'
import styles from '../sui-demo.module.css'
import { useBodyScrollLock, useEscape, useFocusTrap } from './dialog-hooks'

interface SourceViewerProps {
  open: boolean
  onClose: () => void
}

const sourceTabs = [
  {
    id: 'blue',
    label: 'Image #1',
    title: 'Primary blue botanical flyer',
    images: [{ src: assets.flyerBlue, alt: 'salon sui blue botanical flyer source', width: 1055, height: 1491 }]
  },
  {
    id: 'warm',
    label: 'Image #2',
    title: 'Warm minimal treatment menu',
    images: [{ src: assets.flyerWarm, alt: 'salon sui warm treatment menu flyer source', width: 1051, height: 1496 }]
  },
  {
    id: 'cards',
    label: 'Logo / Access',
    title: 'Logo, QR, and access cards',
    images: [
      { src: assets.markCard, alt: 'salon sui mark card', width: 600, height: 1050 },
      { src: assets.accessCard, alt: 'salon sui Instagram QR, LINE QR, and access map card', width: 600, height: 1050 }
    ]
  }
] as const

export function SourceViewer({ open, onClose }: SourceViewerProps) {
  const [activeTab, setActiveTab] = useState<(typeof sourceTabs)[number]['id']>('blue')
  const panelRef = useRef<HTMLDivElement | null>(null)

  useBodyScrollLock(open)
  useEscape(open, onClose)
  useFocusTrap(panelRef, open)

  if (!open) {
    return null
  }

  const currentTab = sourceTabs.find((tab) => tab.id === activeTab) ?? sourceTabs[0]

  return (
    <div className={styles.sourceOverlay}>
      <button type="button" className={styles.overlayBackdrop} aria-label="Source viewerを閉じる" onClick={onClose} />
      <aside className={styles.sourceViewer} ref={panelRef} role="dialog" aria-modal="true" aria-label="Original source materials">
        <div className={styles.viewerHeader}>
          <div>
            <p className={styles.eyebrow}>Source</p>
            <h2>Original Materials</h2>
          </div>
          <button type="button" className={styles.iconButton} aria-label="Source viewerを閉じる" onClick={onClose}>
            <FiX aria-hidden />
          </button>
        </div>
        <div className={styles.sourceTabs} role="tablist" aria-label="Source images">
          {sourceTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={activeTab === tab.id ? styles.sourceTabActive : ''}
              onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className={styles.sourceBody}>
          <h3>{currentTab.title}</h3>
          <div className={styles.sourceImageGrid}>
            {currentTab.images.map((image) => (
              <div key={image.src} className={styles.sourceImageFrame}>
                <Image src={image.src} alt={image.alt} width={image.width} height={image.height} sizes="(max-width: 768px) 92vw, 440px" />
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  )
}
