'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { FiMenu, FiSearch, FiShoppingBag, FiX } from 'react-icons/fi'
import { DemoView, Region, ViewParams } from '../types'
import { RegionSelector } from './RegionSelector'
import { useEscape, useFocusTrap } from './shared'
import styles from '../takumi-market.module.css'

interface HeaderProps {
  currentView: DemoView
  region: Region
  cartCount: number
  cartPulseToken: number
  mobileNavOpen: boolean
  onMobileNavChange: (open: boolean) => void
  onNavigate: (params: ViewParams) => void
  onChangeRegion: (region: Region) => void
  onOpenSearch: () => void
  onOpenCart: () => void
}

export function Header({
  currentView,
  region,
  cartCount,
  cartPulseToken,
  mobileNavOpen,
  onMobileNavChange,
  onNavigate,
  onChangeRegion,
  onOpenSearch,
  onOpenCart
}: HeaderProps) {
  const [badgePulse, setBadgePulse] = useState(false)
  const mobilePanelRef = useRef<HTMLDivElement | null>(null)
  const marketplaceActive = useMemo(
    () => ['marketplace', 'maker', 'product', 'auction'].includes(currentView),
    [currentView]
  )

  useFocusTrap(mobilePanelRef, mobileNavOpen)
  useEscape(mobileNavOpen, () => onMobileNavChange(false))

  useEffect(() => {
    if (cartCount === 0) {
      return
    }

    setBadgePulse(true)
    const timeout = window.setTimeout(() => setBadgePulse(false), 300)
    return () => window.clearTimeout(timeout)
  }, [cartPulseToken, cartCount])

  const navigateAndClose = (params: ViewParams) => {
    onNavigate(params)
    onMobileNavChange(false)
  }

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <button
          type="button"
          className={styles.wordmark}
          onClick={() => onNavigate({ view: 'home', region })}>
          Takumi Market
        </button>

        <nav className={styles.desktopNav} aria-label="Primary navigation">
          <button
            type="button"
            className={`${styles.navLink} ${currentView === 'home' ? styles.navLinkActive : ''}`}
            onClick={() => onNavigate({ view: 'home', region })}>
            Home
          </button>
          <button
            type="button"
            className={`${styles.navLink} ${marketplaceActive ? styles.navLinkActive : ''}`}
            onClick={() => onNavigate({ view: 'marketplace', region })}>
            Marketplace
          </button>
          <button
            type="button"
            className={`${styles.navLink} ${currentView === 'about' ? styles.navLinkActive : ''}`}
            onClick={() => onNavigate({ view: 'about', region })}>
            About
          </button>
        </nav>

        <div className={styles.headerActions}>
          <button type="button" className={styles.iconButton} aria-label="Search catalog" onClick={onOpenSearch}>
            <FiSearch aria-hidden />
          </button>
          <div className={styles.desktopOnly}>
            <RegionSelector region={region} onChange={onChangeRegion} />
          </div>
          <button type="button" className={styles.iconButton} aria-label="Open cart" onClick={onOpenCart}>
            <FiShoppingBag aria-hidden />
            {cartCount > 0 ? (
              <span className={`${styles.cartBadge} ${badgePulse ? styles.cartBadgePulse : ''}`}>{cartCount}</span>
            ) : null}
          </button>
          <button
            type="button"
            className={`${styles.iconButton} ${styles.mobileOnly}`}
            aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
            onClick={() => onMobileNavChange(!mobileNavOpen)}>
            {mobileNavOpen ? <FiX aria-hidden /> : <FiMenu aria-hidden />}
          </button>
        </div>
      </div>

      {mobileNavOpen ? (
        <div className={styles.mobileNavOverlay}>
          <div className={styles.mobileNavPanel} ref={mobilePanelRef} role="dialog" aria-modal="true" aria-label="Mobile navigation">
            <div className={styles.mobileNavHeader}>
              <span className={styles.wordmarkSmall}>Takumi Market</span>
              <button
                type="button"
                className={styles.iconButton}
                aria-label="Close menu"
                onClick={() => onMobileNavChange(false)}>
                <FiX aria-hidden />
              </button>
            </div>
            <div className={styles.mobileNavLinks}>
              <button type="button" className={styles.mobileNavLink} onClick={() => navigateAndClose({ view: 'home', region })}>
                Home
              </button>
              <button
                type="button"
                className={styles.mobileNavLink}
                onClick={() => navigateAndClose({ view: 'marketplace', region })}>
                Marketplace
              </button>
              <button type="button" className={styles.mobileNavLink} onClick={() => navigateAndClose({ view: 'about', region })}>
                About
              </button>
              <button
                type="button"
                className={styles.mobileNavLink}
                onClick={() => {
                  onOpenSearch()
                  onMobileNavChange(false)
                }}>
                Search
              </button>
            </div>
            <div className={styles.mobileNavRegionBlock}>
              <p className={styles.eyebrow}>Region</p>
              <RegionSelector region={region} onChange={onChangeRegion} />
            </div>
          </div>
        </div>
      ) : null}
    </header>
  )
}

