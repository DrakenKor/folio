'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { FiCheckCircle, FiLock, FiX } from 'react-icons/fi'
import { REGION_META } from '../data/regions'
import { Product, Region } from '../types'
import { dutiesEstimate, formatPrice, shippingForRegion, sumShipping, sumSubtotal } from '../utils'
import { useBodyScrollLock, useEscape, useFocusTrap } from './shared'
import styles from '../takumi-market.module.css'

interface CheckoutModalProps {
  open: boolean
  cart: { productId: string; quantity: number }[]
  products: Product[]
  region: Region
  onClose: () => void
  onOrderPlaced: () => void
}

export function CheckoutModal({ open, cart, products, region, onClose, onOrderPlaced }: CheckoutModalProps) {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [complete, setComplete] = useState(false)
  const [shippingForm, setShippingForm] = useState({
    name: 'Aiko Morgan',
    line1: '12 Gallery Street',
    line2: 'Apartment 8B',
    city: 'Brooklyn',
    postalCode: '11201',
    country: REGION_META[region].country
  })
  const [paymentForm, setPaymentForm] = useState({
    cardNumber: '4242 4242 4242 4242',
    expiry: '09/28',
    cvc: '424'
  })
  const panelRef = useRef<HTMLDivElement | null>(null)

  useBodyScrollLock(open)
  useFocusTrap(panelRef, open)
  useEscape(open, onClose)

  const subtotal = useMemo(() => sumSubtotal(products, cart, region), [cart, products, region])
  const shipping = useMemo(() => sumShipping(products, cart, region), [cart, products, region])
  const duties = useMemo(() => dutiesEstimate(subtotal), [subtotal])
  const total = subtotal + shipping + duties

  useEffect(() => {
    if (!open) {
      setStep(0)
      setLoading(false)
      setComplete(false)
      return
    }

    setShippingForm((current) => ({ ...current, country: REGION_META[region].country }))
  }, [open, region])

  if (!open) {
    return null
  }

  const cartProducts = cart
    .map((item) => {
      const product = products.find((entry) => entry.id === item.productId)
      return product ? { product, quantity: item.quantity } : null
    })
    .filter(Boolean) as { product: Product; quantity: number }[]

  const placeOrder = () => {
    setLoading(true)
    window.setTimeout(() => {
      setLoading(false)
      setComplete(true)
      onOrderPlaced()
    }, 1500)
  }

  return (
    <div className={styles.modalOverlay}>
      <button type="button" className={styles.overlayBackdrop} aria-label="Close checkout" onClick={onClose} />
      <div className={styles.checkoutModal} ref={panelRef} role="dialog" aria-modal="true" aria-label="Checkout">
        <div className={styles.checkoutHeader}>
          <div>
            <p className={styles.eyebrow}>Checkout</p>
            <h2 className={styles.sectionTitle}>Complete Your Order</h2>
          </div>
          <button type="button" className={styles.iconButton} aria-label="Close checkout" onClick={onClose}>
            <FiX aria-hidden />
          </button>
        </div>

        {complete ? (
          <div className={styles.checkoutConfirmation}>
            <FiCheckCircle aria-hidden className={styles.confirmationIcon} />
            <h3 className={styles.confirmationTitle}>Thank you for your order.</h3>
            <p className={styles.confirmationCopy}>
              Order TM-{Math.floor(Date.now() / 1000).toString().slice(-6)} confirmed. Your items will ship from Japan within 3-5 business days.
            </p>
            <button type="button" className={styles.buttonPrimary} onClick={onClose}>
              Return to Market
            </button>
          </div>
        ) : loading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner} aria-hidden />
            <p>Preparing your order...</p>
          </div>
        ) : (
          <>
            <div className={styles.stepper} aria-label="Checkout steps">
              {['Shipping', 'Payment', 'Review'].map((label, index) => (
                <div key={label} className={`${styles.step} ${index === step ? styles.stepActive : ''}`}>
                  <span className={styles.stepNumber}>{index + 1}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>

            <div className={styles.checkoutBody}>
              {step === 0 ? (
                <div className={styles.formGrid}>
                  <label className={styles.formField}>
                    <span>Name</span>
                    <input
                      value={shippingForm.name}
                      onChange={(event) => setShippingForm((current) => ({ ...current, name: event.target.value }))}
                    />
                  </label>
                  <label className={styles.formField}>
                    <span>Address Line 1</span>
                    <input
                      value={shippingForm.line1}
                      onChange={(event) => setShippingForm((current) => ({ ...current, line1: event.target.value }))}
                    />
                  </label>
                  <label className={styles.formField}>
                    <span>Address Line 2</span>
                    <input
                      value={shippingForm.line2}
                      onChange={(event) => setShippingForm((current) => ({ ...current, line2: event.target.value }))}
                    />
                  </label>
                  <label className={styles.formField}>
                    <span>City</span>
                    <input
                      value={shippingForm.city}
                      onChange={(event) => setShippingForm((current) => ({ ...current, city: event.target.value }))}
                    />
                  </label>
                  <label className={styles.formField}>
                    <span>Postal Code</span>
                    <input
                      value={shippingForm.postalCode}
                      onChange={(event) => setShippingForm((current) => ({ ...current, postalCode: event.target.value }))}
                    />
                  </label>
                  <label className={styles.formField}>
                    <span>Country</span>
                    <select
                      value={shippingForm.country}
                      onChange={(event) => setShippingForm((current) => ({ ...current, country: event.target.value }))}>
                      {Object.values(REGION_META).map((entry) => (
                        <option key={entry.code} value={entry.country}>
                          {entry.country}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}

              {step === 1 ? (
                <div className={styles.formGrid}>
                  <div className={styles.reassuranceStrip}>
                    <FiLock aria-hidden />
                    <span>Secure checkout · SSL encrypted</span>
                  </div>
                  <label className={styles.formField}>
                    <span>Card Number</span>
                    <input
                      value={paymentForm.cardNumber}
                      onChange={(event) => setPaymentForm((current) => ({ ...current, cardNumber: event.target.value }))}
                    />
                  </label>
                  <label className={styles.formField}>
                    <span>Expiry</span>
                    <input
                      value={paymentForm.expiry}
                      onChange={(event) => setPaymentForm((current) => ({ ...current, expiry: event.target.value }))}
                    />
                  </label>
                  <label className={styles.formField}>
                    <span>CVC</span>
                    <input
                      value={paymentForm.cvc}
                      onChange={(event) => setPaymentForm((current) => ({ ...current, cvc: event.target.value }))}
                    />
                  </label>
                </div>
              ) : null}

              {step === 2 ? (
                <div className={styles.reviewPanel}>
                  <div className={styles.reviewList}>
                    {cartProducts.map(({ product, quantity }) => (
                      <div key={product.id} className={styles.reviewRow}>
                        <span>
                          {product.name} × {quantity}
                        </span>
                        <span>{formatPrice(product.pricing[region] * quantity, region)}</span>
                      </div>
                    ))}
                  </div>
                  <div className={styles.reviewTotals}>
                    <div className={styles.reviewRow}>
                      <span>Subtotal</span>
                      <span>{formatPrice(subtotal, region)}</span>
                    </div>
                    <div className={styles.reviewRow}>
                      <span>Shipping</span>
                      <span>{formatPrice(shipping, region)}</span>
                    </div>
                    <div className={styles.reviewRow}>
                      <span>Estimated duties</span>
                      <span>{formatPrice(duties, region)}</span>
                    </div>
                    <div className={`${styles.reviewRow} ${styles.reviewTotal}`}>
                      <span>Total</span>
                      <span>{formatPrice(total, region)}</span>
                    </div>
                  </div>
                  <div className={styles.reviewDestination}>
                    <p>Shipping to {shippingForm.name}</p>
                    <p>
                      {shippingForm.line1}
                      {shippingForm.line2 ? `, ${shippingForm.line2}` : ''}
                    </p>
                    <p>
                      {shippingForm.city}, {shippingForm.postalCode}, {shippingForm.country}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className={styles.checkoutFooter}>
              <button type="button" className={styles.buttonGhost} onClick={() => (step === 0 ? onClose() : setStep((current) => current - 1))}>
                {step === 0 ? 'Cancel' : 'Back'}
              </button>
              {step < 2 ? (
                <button type="button" className={styles.buttonPrimary} onClick={() => setStep((current) => current + 1)}>
                  Continue
                </button>
              ) : (
                <button type="button" className={styles.buttonPrimary} onClick={placeOrder}>
                  Place Order
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

