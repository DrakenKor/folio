'use client'

import { FiX } from 'react-icons/fi'
import { ToastItem } from '../types'
import styles from '../takumi-market.module.css'

interface ToastViewportProps {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
  onFollowLink: (toast: ToastItem) => void
}

export function ToastViewport({ toasts, onDismiss, onFollowLink }: ToastViewportProps) {
  if (toasts.length === 0) {
    return null
  }

  return (
    <div className={styles.toastViewport} aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div key={toast.id} className={`${styles.toast} ${styles[`toast${capitalize(toast.type)}`]}`}>
          <div className={styles.toastContent}>
            <p className={styles.toastMessage}>{toast.message}</p>
            {toast.link ? (
              <button type="button" className={styles.toastLink} onClick={() => onFollowLink(toast)}>
                {toast.link.label}
              </button>
            ) : null}
          </div>
          <button type="button" className={styles.toastDismiss} aria-label="Dismiss notification" onClick={() => onDismiss(toast.id)}>
            <FiX aria-hidden />
          </button>
        </div>
      ))}
    </div>
  )
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

