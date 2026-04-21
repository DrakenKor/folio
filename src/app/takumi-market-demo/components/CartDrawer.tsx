'use client'

import { FiMinus, FiPlus, FiTrash2, FiX } from 'react-icons/fi'
import { Maker, Product, Region } from '../types'
import { AnimatedPrice, DemoImage, useBodyScrollLock, useEscape, useFocusTrap } from './shared'
import { formatPrice, shippingForRegion, sumShipping, sumSubtotal } from '../utils'
import styles from '../takumi-market.module.css'
import { useMemo, useRef } from 'react'

interface CartDrawerProps {
  open: boolean
  cart: { productId: string; quantity: number }[]
  products: Product[]
  makers: Maker[]
  region: Region
  onClose: () => void
  onCheckout: () => void
  onNavigateMarketplace: () => void
  onUpdateQuantity: (productId: string, quantity: number) => void
  onRemove: (productId: string) => void
}

export function CartDrawer({
  open,
  cart,
  products,
  makers,
  region,
  onClose,
  onCheckout,
  onNavigateMarketplace,
  onUpdateQuantity,
  onRemove
}: CartDrawerProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  useBodyScrollLock(open)
  useFocusTrap(panelRef, open)
  useEscape(open, onClose)

  const subtotal = useMemo(() => sumSubtotal(products, cart, region), [cart, products, region])
  const shipping = useMemo(() => sumShipping(products, cart, region), [cart, products, region])

  if (!open) {
    return null
  }

  return (
    <div className={styles.drawerOverlay}>
      <button type="button" className={styles.overlayBackdropSoft} aria-label="Close cart" onClick={onClose} />
      <aside className={styles.cartDrawer} ref={panelRef} aria-modal="true" role="dialog" aria-label="Your cart">
        <div className={styles.cartDrawerHandle} />
        <div className={styles.cartHeader}>
          <div>
            <p className={styles.eyebrow}>Cart</p>
            <h2 className={styles.cartTitle}>Your Cart {cart.length > 0 ? `(${cart.length})` : ''}</h2>
          </div>
          <button type="button" className={styles.iconButton} aria-label="Close cart" onClick={onClose}>
            <FiX aria-hidden />
          </button>
        </div>

        {cart.length === 0 ? (
          <div className={styles.emptyState}>
            <p>Your cart is empty. Browse the market to find something you love.</p>
            <button
              type="button"
              className={styles.buttonPrimary}
              onClick={() => {
                onNavigateMarketplace()
                onClose()
              }}>
              Browse the Market
            </button>
          </div>
        ) : (
          <>
            <div className={styles.cartList}>
              {cart.map((item) => {
                const product = products.find((entry) => entry.id === item.productId)
                if (!product) {
                  return null
                }
                const maker = makers.find((entry) => entry.id === product.makerId)
                const shippingInfo = shippingForRegion(product.shipping, region)

                return (
                  <article key={item.productId} className={styles.cartItem}>
                    <DemoImage src={product.images[0].url} alt={product.images[0].alt} className={styles.cartItemImage} />
                    <div className={styles.cartItemBody}>
                      <p className={styles.cartItemTitle}>{product.name}</p>
                      <p className={styles.cartItemMaker}>{maker?.name}</p>
                      <p className={styles.cartItemShipping}>{shippingInfo.estimatedDays[0]}-{shippingInfo.estimatedDays[1]} day ship window</p>
                      <div className={styles.cartItemRow}>
                        <div className={styles.quantityControl}>
                          <button type="button" aria-label={`Decrease quantity for ${product.name}`} onClick={() => onUpdateQuantity(product.id, item.quantity - 1)}>
                            <FiMinus aria-hidden />
                          </button>
                          <span>{item.quantity}</span>
                          <button type="button" aria-label={`Increase quantity for ${product.name}`} onClick={() => onUpdateQuantity(product.id, item.quantity + 1)}>
                            <FiPlus aria-hidden />
                          </button>
                        </div>
                        <AnimatedPrice value={product.pricing[region] * item.quantity} region={region} className={styles.cartLinePrice} />
                      </div>
                    </div>
                    <button type="button" className={styles.cartRemoveButton} aria-label={`Remove ${product.name}`} onClick={() => onRemove(product.id)}>
                      <FiTrash2 aria-hidden />
                    </button>
                  </article>
                )
              })}
            </div>
            <div className={styles.cartFooter}>
              <div className={styles.cartSummary}>
                <div className={styles.summaryRow}>
                  <span>Subtotal</span>
                  <span>{formatPrice(subtotal, region)}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span>Estimated shipping</span>
                  <span>{formatPrice(shipping, region)}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span>Duties note</span>
                  <span>Import duties may apply.</span>
                </div>
              </div>
              <button
                type="button"
                className={styles.buttonPrimary}
                onClick={() => {
                  onClose()
                  onCheckout()
                }}>
                Proceed to Checkout
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
