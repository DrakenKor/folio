'use client'

import { useMemo, useState } from 'react'
import { FiCheck, FiCheckCircle, FiMinus, FiPlus } from 'react-icons/fi'
import { Auction, Maker, Product, Region, ViewParams } from '../../types'
import { REGION_META } from '../../data/regions'
import { AnimatedPrice, DemoImage, Reveal } from '../shared'
import { ProductCard } from '../ProductCard'
import { CATEGORY_LABELS, getStockLabel, getStockTone, shippingForRegion } from '../../utils'
import styles from '../../takumi-market.module.css'

interface ProductViewProps {
  product: Product
  maker: Maker
  relatedProducts: Product[]
  auctions: Auction[]
  region: Region
  onNavigate: (params: ViewParams) => void
  onAddToCart: (product: Product, quantity: number) => void
}

const tabs = ['overview', 'process', 'shipping', 'maker-notes'] as const
type TabKey = (typeof tabs)[number]

export function ProductView({ product, maker, relatedProducts, auctions, region, onNavigate, onAddToCart }: ProductViewProps) {
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [added, setAdded] = useState(false)
  const auction = auctions.find((entry) => entry.id === product.auctionId)
  const shipping = shippingForRegion(product.shipping, region)
  const stockLabel = getStockLabel(product, auction)
  const stockToneClass = styles[`stockBadge${capitalize(getStockTone(product, auction))}`]

  const mediaItems = useMemo(() => product.images, [product.images])

  const handleAdd = () => {
    onAddToCart(product, quantity)
    setAdded(true)
    window.setTimeout(() => setAdded(false), 300)
  }

  return (
    <div className={`${styles.viewStack} ${styles.productViewStack}`}>
      <section className={styles.sectionShell}>
        <div className={styles.productDetailGrid}>
          <Reveal>
            <div className={styles.mediaColumn}>
              <DemoImage
                src={mediaItems[selectedMediaIndex].url}
                alt={mediaItems[selectedMediaIndex].alt}
                className={styles.productPrimaryMedia}
                loading="eager"
              />
              <div className={styles.thumbnailStrip}>
                {mediaItems.map((image, index) => (
                  <button
                    key={image.url}
                    type="button"
                    className={`${styles.thumbnailButton} ${selectedMediaIndex === index ? styles.thumbnailButtonActive : ''}`}
                    onClick={() => setSelectedMediaIndex(index)}>
                    <DemoImage src={image.url} alt={image.alt} className={styles.thumbnailImage} />
                  </button>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal>
            <div className={styles.detailColumn}>
              <p className={styles.eyebrow}>{CATEGORY_LABELS[product.category]}</p>
              <h1 className={styles.sectionTitle}>{product.name}</h1>
              <button type="button" className={styles.makerLinkLarge} onClick={() => onNavigate({ view: 'maker', id: maker.id, region })}>
                {maker.name}
              </button>
              <p className={styles.bodyCopyMuted}>{product.origin}</p>
              <AnimatedPrice value={product.pricing[region]} region={region} className={styles.heroPrice} />
              <p className={styles.priceFootnote}>Taxes & duties may apply at import.</p>
              <div className={styles.mobileProductFacts}>
                <div className={styles.mobileProductFact}>
                  <span className={styles.metaLabel}>Technique</span>
                  <span className={styles.mobileProductFactValue}>{product.technique}</span>
                </div>
                <div className={styles.mobileProductFact}>
                  <span className={styles.metaLabel}>Material</span>
                  <span className={styles.mobileProductFactValue}>{product.materials[0]}</span>
                </div>
                <div className={styles.mobileProductFact}>
                  <span className={styles.metaLabel}>Ships In</span>
                  <span className={styles.mobileProductFactValue}>
                    {shipping.estimatedDays[0]}-{shipping.estimatedDays[1]} days
                  </span>
                </div>
              </div>

              <div className={styles.detailBadgeRow}>
                <span className={`${styles.stockBadge} ${stockToneClass}`}>{stockLabel}</span>
                <span className={styles.condensedTrust}>
                  <FiCheckCircle aria-hidden />
                  Vetted Maker
                </span>
              </div>

              {product.stockStatus !== 'made-to-order' ? (
                <div className={styles.quantityControlLarge}>
                  <button type="button" aria-label="Decrease quantity" onClick={() => setQuantity((current) => Math.max(1, current - 1))}>
                    <FiMinus aria-hidden />
                  </button>
                  <span>{quantity}</span>
                  <button type="button" aria-label="Increase quantity" onClick={() => setQuantity((current) => Math.min(5, current + 1))}>
                    <FiPlus aria-hidden />
                  </button>
                </div>
              ) : (
                <p className={styles.bodyCopyMuted}>Made to order. Lead time is reflected in regional shipping estimates below.</p>
              )}

              <button
                type="button"
                className={styles.buttonPrimary}
                disabled={product.stockStatus === 'sold-out'}
                onClick={handleAdd}>
                {product.stockStatus === 'sold-out' ? 'Sold Out' : added ? <><FiCheck aria-hidden /> Added</> : 'Add to Cart'}
              </button>

              {auction ? (
                <div className={styles.inventorySplitCard}>
                  <p className={styles.bodyCopy}>
                    {product.stockCount ?? auction.totalUnits - auction.auctionUnits} of {auction.totalUnits} units available at fixed price. {auction.auctionUnits} units in {auction.status === 'live' ? 'live' : 'upcoming'} auction.
                  </p>
                  <button
                    type="button"
                    className={styles.inlineAction}
                    onClick={() => onNavigate({ view: 'auction', id: auction.id, region })}>
                    View auction release
                  </button>
                </div>
              ) : null}

              <div className={styles.shippingNoteBlock}>
                <p className={styles.bodyCopy}>Ships to {REGION_META[region].country} in {shipping.estimatedDays[0]}-{shipping.estimatedDays[1]} days.</p>
                <p className={styles.bodyCopyMuted}>Import duties may apply for {REGION_META[region].country}.</p>
              </div>

              <div className={styles.trustMarkerList}>
                {['Vetted by Takumi Market', 'Origin verified', 'Materials disclosed', 'Process documented', 'Small-batch release'].map((item) => (
                  <span key={item} className={styles.condensedTrust}>
                    <FiCheckCircle aria-hidden />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className={styles.sectionShell}>
        <Reveal>
          <div className={styles.tabBar} role="tablist" aria-label="Product details">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                className={`${styles.tabButton} ${activeTab === tab ? styles.tabButtonActive : ''}`}
                onClick={() => setActiveTab(tab)}>
                {tab === 'maker-notes' ? 'Maker Notes' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </Reveal>

        <div className={styles.tabContent}>
          {activeTab === 'overview' ? (
            <Reveal>
              <div className={styles.specTable}>
                <div className={styles.specRow}>
                  <span>Materials</span>
                  <span>{product.materials.join(', ')}</span>
                </div>
                <div className={styles.specRow}>
                  <span>Technique</span>
                  <span>{product.technique}</span>
                </div>
                <div className={styles.specRow}>
                  <span>Dimensions</span>
                  <span>{product.dimensions}</span>
                </div>
                <div className={styles.specRow}>
                  <span>Weight</span>
                  <span>{product.weight}</span>
                </div>
                <div className={styles.specRow}>
                  <span>Care</span>
                  <span>{product.care}</span>
                </div>
              </div>
            </Reveal>
          ) : null}

          {activeTab === 'process' ? (
            <Reveal>
              <div className={styles.processNarrative}>
                {product.story.split('\n\n').map((paragraph) => (
                  <p key={paragraph} className={styles.bodyCopy}>
                    {paragraph}
                  </p>
                ))}
                <div className={styles.inlineProcessImages}>
                  {maker.processImages.slice(0, 2).map((image) => (
                    <DemoImage key={image.url} src={image.url} alt={image.alt} className={styles.inlineProcessImage} />
                  ))}
                </div>
              </div>
            </Reveal>
          ) : null}

          {activeTab === 'shipping' ? (
            <Reveal>
              <div className={styles.specTable}>
                {product.shipping.map((entry) => (
                  <div key={entry.region} className={styles.specRow}>
                    <span>{REGION_META[entry.region].country}</span>
                    <span>
                      {entry.estimatedDays[0]}-{entry.estimatedDays[1]} days · <AnimatedPrice value={entry.cost} region={entry.region} />
                    </span>
                  </div>
                ))}
              </div>
            </Reveal>
          ) : null}

          {activeTab === 'maker-notes' ? (
            <Reveal>
              <div className={styles.noteCard}>
                <p className={styles.handwrittenNote}>{product.makerNotes ?? maker.makerNotes}</p>
              </div>
            </Reveal>
          ) : null}
        </div>
      </section>

      <section className={styles.sectionShell}>
        <Reveal>
          <div className={styles.provenanceCard}>
            <div className={styles.provenanceSeal}>Verified</div>
            <div>
              <h2 className={styles.sectionTitle}>Vetted by Takumi Market</h2>
              <p className={styles.bodyCopyMuted}>
                Verification date {maker.verifiedDate}. Origin verified, materials disclosed, process documented.
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      <section className={styles.sectionShell}>
        <Reveal>
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>Related Products</p>
            <h2 className={styles.sectionTitle}>More to explore from this maker and category.</h2>
          </div>
        </Reveal>
        <div className={styles.marketplaceGrid}>
          {relatedProducts.slice(0, 4).map((related, index) => (
            <Reveal key={related.id} delay={index * 60}>
              <ProductCard
                product={related}
                maker={related.makerId === maker.id ? maker : maker}
                region={region}
                auction={auctions.find((entry) => entry.id === related.auctionId)}
                onOpenProduct={(id) => onNavigate({ view: 'product', id, region })}
                onOpenMaker={(id) => onNavigate({ view: 'maker', id, region })}
              />
            </Reveal>
          ))}
        </div>
      </section>

      <div className={styles.mobilePurchaseBar}>
        <div className={styles.mobilePurchaseMeta}>
          <AnimatedPrice value={product.pricing[region]} region={region} className={styles.mobilePurchasePrice} />
          <p className={styles.mobilePurchaseNote}>
            {product.stockStatus === 'made-to-order'
              ? 'Made to order with regional shipping estimates shown above.'
              : `${stockLabel} · ships to ${REGION_META[region].country} in ${shipping.estimatedDays[0]}-${shipping.estimatedDays[1]} days.`}
          </p>
        </div>
        <div className={styles.mobilePurchaseControls}>
          {product.stockStatus !== 'made-to-order' ? (
            <div className={styles.quantityControl}>
              <button type="button" aria-label="Decrease quantity" onClick={() => setQuantity((current) => Math.max(1, current - 1))}>
                <FiMinus aria-hidden />
              </button>
              <span>{quantity}</span>
              <button type="button" aria-label="Increase quantity" onClick={() => setQuantity((current) => Math.min(5, current + 1))}>
                <FiPlus aria-hidden />
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className={`${styles.buttonPrimary} ${styles.mobilePurchaseButton}`}
            disabled={product.stockStatus === 'sold-out'}
            onClick={handleAdd}>
            {product.stockStatus === 'sold-out' ? 'Sold Out' : added ? <><FiCheck aria-hidden /> Added</> : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  )
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
