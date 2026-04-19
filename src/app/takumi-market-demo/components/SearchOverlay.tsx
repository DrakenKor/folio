'use client'

import { useDeferredValue, useEffect, useMemo, useRef } from 'react'
import { FiSearch, FiX } from 'react-icons/fi'
import { Maker, Product, Region } from '../types'
import { searchCatalog } from '../utils'
import { AnimatedPrice, DemoImage, useBodyScrollLock, useDebouncedValue, useEscape, useFocusTrap } from './shared'
import styles from '../takumi-market.module.css'

interface SearchOverlayProps {
  open: boolean
  query: string
  products: Product[]
  makers: Maker[]
  region: Region
  onClose: () => void
  onQueryChange: (query: string) => void
  onOpenProduct: (productId: string) => void
  onOpenMaker: (makerId: string) => void
}

export function SearchOverlay({
  open,
  query,
  products,
  makers,
  region,
  onClose,
  onQueryChange,
  onOpenProduct,
  onOpenMaker
}: SearchOverlayProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const debouncedQuery = useDebouncedValue(query, 150)
  const deferredQuery = useDeferredValue(debouncedQuery)
  const results = useMemo(() => searchCatalog(products, makers, deferredQuery), [deferredQuery, makers, products])

  useBodyScrollLock(open)
  useFocusTrap(panelRef, open)
  useEscape(open, onClose)

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
    }
  }, [open])

  if (!open) {
    return null
  }

  return (
    <div className={styles.searchOverlay}>
      <button type="button" className={styles.overlayBackdrop} aria-label="Close search" onClick={onClose} />
      <div className={styles.searchPanel} ref={panelRef} role="dialog" aria-modal="true" aria-label="Search catalog">
        <div className={styles.searchHeader}>
          <div className={styles.searchInputShell}>
            <FiSearch aria-hidden className={styles.searchIcon} />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              className={styles.searchInput}
              placeholder="Search products, makers, materials, origin…"
            />
          </div>
          <button type="button" className={styles.iconButton} aria-label="Close search" onClick={onClose}>
            <FiX aria-hidden />
          </button>
        </div>

        {!query.trim() ? (
          <div className={styles.searchHint}>Start typing to search products and makers.</div>
        ) : results.products.length === 0 && results.makers.length === 0 ? (
          <div className={styles.searchHint}>Nothing found — try browsing by category.</div>
        ) : (
          <div className={styles.searchResults}>
            {results.products.length > 0 ? (
              <section>
                <p className={styles.searchGroupLabel}>Products</p>
                <div className={styles.searchGroup}>
                  {results.products.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      className={styles.searchResultCard}
                      onClick={() => {
                        onOpenProduct(product.id)
                        onClose()
                      }}>
                      <DemoImage src={product.images[0].url} alt={product.images[0].alt} className={styles.searchResultImage} />
                      <div>
                        <p className={styles.searchResultTitle}>{product.name}</p>
                        <AnimatedPrice value={product.pricing[region]} region={region} className={styles.searchResultMeta} />
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {results.makers.length > 0 ? (
              <section>
                <p className={styles.searchGroupLabel}>Makers</p>
                <div className={styles.searchGroup}>
                  {results.makers.map((maker) => (
                    <button
                      key={maker.id}
                      type="button"
                      className={styles.searchResultCard}
                      onClick={() => {
                        onOpenMaker(maker.id)
                        onClose()
                      }}>
                      <DemoImage src={maker.heroImage.url} alt={maker.heroImage.alt} className={styles.searchResultAvatar} />
                      <div>
                        <p className={styles.searchResultTitle}>{maker.name}</p>
                        <p className={styles.searchResultMeta}>{maker.craft}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

