'use client'

import { useMemo } from 'react'
import { FiArrowRight } from 'react-icons/fi'
import { Auction, Category, Collection, Maker, Product, Region, SortOption, ViewParams } from '../../types'
import { CATEGORY_LABELS, filterProducts, sortProducts } from '../../utils'
import { DemoImage, Reveal } from '../shared'
import { ProductCard } from '../ProductCard'
import styles from '../../takumi-market.module.css'

interface MarketplaceViewProps {
  region: Region
  makers: Maker[]
  products: Product[]
  auctions: Auction[]
  collections: Collection[]
  selectedCategory?: Category
  selectedCollectionId?: string
  sort: SortOption
  onNavigate: (params: ViewParams) => void
}

export function MarketplaceView({
  region,
  makers,
  products,
  auctions,
  collections,
  selectedCategory,
  selectedCollectionId,
  sort,
  onNavigate
}: MarketplaceViewProps) {
  const makersById = useMemo(
    () => makers.reduce<Record<string, Maker>>((accumulator, maker) => ({ ...accumulator, [maker.id]: maker }), {}),
    [makers]
  )
  const selectedCollection = collections.find((collection) => collection.id === selectedCollectionId)
  const filtered = filterProducts(products, selectedCategory, selectedCollection)
  const sorted = sortProducts(filtered, region, sort, makersById)
  const activeCategoryLabel = selectedCategory ? CATEGORY_LABELS[selectedCategory] : 'All categories'
  const activeCollectionLabel = selectedCollection ? selectedCollection.name : 'All collections'
  const hasActiveFilters = Boolean(selectedCategory || selectedCollectionId)

  const gridItems = useMemo(() => {
    const entries: Array<{ type: 'product'; product: Product } | { type: 'spotlight'; maker: Maker }> = []
    sorted.forEach((product, index) => {
      entries.push({ type: 'product', product })
      if ((index + 1) % 8 === 0 && makers.length > 0) {
        const maker = makers[Math.floor(index / 8) % makers.length]
        if (maker) {
          entries.push({ type: 'spotlight', maker })
        }
      }
    })
    return entries
  }, [makers, sorted])

  return (
    <div className={styles.viewStack}>
      <section className={styles.sectionShellCompact}>
        <Reveal>
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>Marketplace</p>
            <h1 className={styles.sectionTitle}>A selective market, not a sprawling catalog.</h1>
            <p className={styles.bodyCopy}>
              Browse products and makers with region-aware pricing, editorial collections, and clear stock states.
            </p>
          </div>
        </Reveal>
      </section>

      <section className={styles.sectionShellCompact}>
        <div className={styles.filterBar}>
          <div className={styles.filterSummary}>
            <div className={styles.filterSummaryText}>
              <p className={styles.metaLabel}>
                {sorted.length} piece{sorted.length === 1 ? '' : 's'} showing · {region}
              </p>
              <p className={styles.bodyCopyMuted}>
                {activeCategoryLabel} · {activeCollectionLabel}
              </p>
            </div>
            {hasActiveFilters ? (
              <button type="button" className={styles.buttonGhost} onClick={() => onNavigate({ view: 'marketplace', sort, region })}>
                Clear Filters
              </button>
            ) : null}
          </div>

          <div className={styles.categoryFilterRow}>
            <button
              type="button"
              className={`${styles.regionPill} ${!selectedCategory ? styles.regionPillActive : ''}`}
              onClick={() => onNavigate({ view: 'marketplace', sort, collection: selectedCollectionId, region })}>
              All
            </button>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`${styles.regionPill} ${selectedCategory === value ? styles.regionPillActive : ''}`}
                onClick={() =>
                  onNavigate({
                    view: 'marketplace',
                    category: value as Category,
                    sort,
                    collection: selectedCollectionId,
                    region
                  })
                }>
                {label}
              </button>
            ))}
          </div>

          <div className={styles.filterSelectRow}>
            <label className={styles.selectField}>
              <span>Sort</span>
              <select
                value={sort}
                onChange={(event) =>
                  onNavigate({
                    view: 'marketplace',
                    category: selectedCategory,
                    collection: selectedCollectionId,
                    sort: event.target.value as SortOption,
                    region
                  })
                }>
                <option value="newest">Newest</option>
                <option value="price-asc">Price Low→High</option>
                <option value="price-desc">Price High→Low</option>
                <option value="maker-asc">Maker A→Z</option>
              </select>
            </label>

            <label className={styles.selectField}>
              <span>Collection</span>
              <select
                value={selectedCollectionId ?? ''}
                onChange={(event) =>
                  onNavigate({
                    view: 'marketplace',
                    category: selectedCategory,
                    sort,
                    collection: event.target.value || undefined,
                    region
                  })
                }>
                <option value="">All Collections</option>
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>

      {selectedCollection ? (
        <section className={styles.sectionShellCompact}>
          <Reveal>
            <div className={styles.collectionHeader}>
              <p className={styles.eyebrow}>Curated Collection</p>
              <h2 className={styles.sectionTitle}>{selectedCollection.name}</h2>
              <p className={styles.bodyCopy}>{selectedCollection.description}</p>
            </div>
          </Reveal>
        </section>
      ) : null}

      <section className={styles.sectionShellCompact}>
        {sorted.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No products match your filters. Try a different category or clear your filters.</p>
            <button type="button" className={styles.buttonSecondary} onClick={() => onNavigate({ view: 'marketplace', region })}>
              Clear Filters
            </button>
          </div>
        ) : (
          <div className={styles.marketplaceGrid}>
            {gridItems.map((entry, index) =>
              entry.type === 'product' ? (
                <Reveal key={entry.product.id} delay={Math.min(index * 40, 240)}>
                  <ProductCard
                    product={entry.product}
                    maker={makersById[entry.product.makerId]}
                    region={region}
                    auction={auctions.find((auction) => auction.id === entry.product.auctionId)}
                    onOpenProduct={(id) => onNavigate({ view: 'product', id, region })}
                    onOpenMaker={(id) => onNavigate({ view: 'maker', id, region })}
                  />
                </Reveal>
              ) : (
                <Reveal key={`spotlight-${entry.maker.id}-${index}`} className={styles.spotlightSpan}>
                  <div className={styles.makerSpotlight}>
                    <DemoImage src={entry.maker.heroImage.url} alt={entry.maker.heroImage.alt} className={styles.makerSpotlightImage} />
                    <div className={styles.makerSpotlightBody}>
                      <p className={styles.eyebrow}>Maker Spotlight</p>
                      <h3 className={styles.sectionTitle}>{entry.maker.name}</h3>
                      <p className={styles.bodyCopy}>{entry.maker.pullQuote}</p>
                      <button
                        type="button"
                        className={styles.inlineAction}
                        onClick={() => onNavigate({ view: 'maker', id: entry.maker.id, region })}>
                        Visit Shopfront
                        <FiArrowRight aria-hidden />
                      </button>
                    </div>
                  </div>
                </Reveal>
              )
            )}
          </div>
        )}
      </section>
    </div>
  )
}
