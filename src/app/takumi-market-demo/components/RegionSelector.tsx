'use client'

import { useEffect, useRef, useState } from 'react'
import { FiChevronDown, FiCheck } from 'react-icons/fi'
import { REGIONS } from '../data/regions'
import { Region } from '../types'
import { useEscape, useFocusTrap, useMediaQuery } from './shared'
import styles from '../takumi-market.module.css'

interface RegionSelectorProps {
  region: Region
  onChange: (region: Region) => void
}

export function RegionSelector({ region, onChange }: RegionSelectorProps) {
  const [open, setOpen] = useState(false)
  const isMobile = useMediaQuery('(max-width: 767px)')
  const containerRef = useRef<HTMLDivElement | null>(null)
  const sheetRef = useRef<HTMLDivElement | null>(null)

  useFocusTrap(sheetRef, open && isMobile)
  useEscape(open, () => setOpen(false))

  useEffect(() => {
    if (!open) {
      return
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  return (
    <div className={styles.regionSelector} ref={containerRef}>
      <button
        type="button"
        className={styles.headerPillButton}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}>
        {region}
        <FiChevronDown aria-hidden />
      </button>

      {open && !isMobile ? (
        <div className={styles.regionDropdown} role="listbox" aria-label="Region selector">
          {REGIONS.map((entry) => (
            <button
              key={entry.code}
              type="button"
              role="option"
              aria-selected={entry.code === region}
              className={styles.regionDropdownItem}
              onClick={() => {
                onChange(entry.code)
                setOpen(false)
              }}>
              <span className={styles.regionDropdownMeta}>
                <span className={styles.regionDot} data-active={entry.code === region} />
                <span>{entry.flagLabel}</span>
                <span>{entry.label}</span>
              </span>
              <span className={styles.regionDropdownCountry}>{entry.country}</span>
            </button>
          ))}
        </div>
      ) : null}

      {open && isMobile ? (
        <div className={styles.sheetOverlay} role="presentation">
          <button
            type="button"
            aria-label="Close region selector"
            className={styles.overlayBackdrop}
            onClick={() => setOpen(false)}
          />
          <div className={styles.sheetPanel} ref={sheetRef} role="dialog" aria-modal="true" aria-label="Select region">
            <div className={styles.sheetHandle} />
            <div className={styles.sheetHeadingRow}>
              <p className={styles.eyebrow}>Region</p>
              <button type="button" className={styles.textButton} onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            <div className={styles.regionSheetList}>
              {REGIONS.map((entry) => (
                <button
                  key={entry.code}
                  type="button"
                  className={styles.regionSheetItem}
                  onClick={() => {
                    onChange(entry.code)
                    setOpen(false)
                  }}>
                  <span>
                    {entry.flagLabel} · {entry.country}
                  </span>
                  {entry.code === region ? <FiCheck aria-hidden /> : null}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

