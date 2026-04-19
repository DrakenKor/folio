'use client'

import { FormEvent, useState } from 'react'
import { REGIONS } from '../data/regions'
import { Region, ViewParams } from '../types'
import styles from '../takumi-market.module.css'

export function Footer({
  region,
  onNavigate
}: {
  region: Region
  onNavigate: (params: ViewParams) => void
}) {
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!email.trim()) {
      return
    }
    setEmail('')
    setSubscribed(true)
  }

  return (
    <footer className={styles.footer}>
      <div className={styles.footerTop}>
        <div>
          <p className={styles.footerMission}>Vetted Japanese craft, shipped to the world with clarity, context, and fair pricing.</p>
          <div className={styles.footerLinks}>
            <button type="button" className={styles.footerLink} onClick={() => onNavigate({ view: 'about', region })}>
              About
            </button>
            <button type="button" className={styles.footerLink} onClick={() => onNavigate({ view: 'about', region })}>
              Trust
            </button>
            <button type="button" className={styles.footerLink} onClick={() => onNavigate({ view: 'about', region })}>
              FAQ
            </button>
          </div>
        </div>

        <div>
          <p className={styles.footerLabel}>Shipping Regions</p>
          <p className={styles.footerRegionList}>
            {REGIONS.map((entry) => `${entry.flagLabel} ${entry.country}`).join(' · ')}
          </p>
        </div>

        <form className={styles.subscribeForm} onSubmit={onSubmit}>
          <label className={styles.footerLabel} htmlFor="takumi-subscribe">
            Subscribe for new maker drops
          </label>
          <div className={styles.subscribeRow}>
            <input
              id="takumi-subscribe"
              className={styles.subscribeInput}
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
                setSubscribed(false)
              }}
            />
            <button type="submit" className={styles.buttonSecondary}>
              Subscribe
            </button>
          </div>
          {subscribed ? <p className={styles.inlineSuccess}>Subscribed</p> : null}
        </form>
      </div>
      <p className={styles.footerFinePrint}>This is a demo experience. No real transactions.</p>
    </footer>
  )
}

