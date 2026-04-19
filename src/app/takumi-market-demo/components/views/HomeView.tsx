'use client'

import { useEffect, useMemo, useState } from 'react'
import { FiCheckCircle, FiGlobe, FiMapPin, FiPackage, FiShield, FiTruck } from 'react-icons/fi'
import { REGIONS } from '../../data/regions'
import { Auction, Maker, Product, Region, ViewParams } from '../../types'
import { countdownParts, getLiveAuction, getProductById } from '../../utils'
import { AnimatedPrice, DemoImage, Reveal, useMediaQuery, useNow, usePrefersReducedMotion } from '../shared'
import { MakerCard } from '../MakerCard'
import styles from '../../takumi-market.module.css'

const categoryTiles = [
  { id: 'tableware', label: 'Tableware', seed: 'tableware-tile' },
  { id: 'kitchen-tools', label: 'Kitchen Tools', seed: 'kitchen-tools-tile' },
  { id: 'textiles', label: 'Textiles', seed: 'textiles-tile' },
  { id: 'tea-ritual', label: 'Tea Ritual', seed: 'tea-ritual-tile' },
  { id: 'paper-goods', label: 'Paper Goods', seed: 'paper-goods-tile' },
  { id: 'home-objects', label: 'Home Objects', seed: 'home-objects-tile' }
] as const

const trustItems = [
  { label: 'Vetted makers only', icon: FiShield },
  { label: 'Verified provenance', icon: FiCheckCircle },
  { label: 'Materials disclosed', icon: FiPackage },
  { label: 'Global shipping', icon: FiTruck },
  { label: 'Fair pricing', icon: FiGlobe }
]

const routes = [
  { region: 'JPY', x: 210, y: 154 },
  { region: 'USD', x: 560, y: 150 },
  { region: 'EUR', x: 470, y: 105 },
  { region: 'GBP', x: 440, y: 88 },
  { region: 'SGD', x: 335, y: 225 }
] as const

interface HomeViewProps {
  region: Region
  makers: Maker[]
  products: Product[]
  auctions: Auction[]
  onNavigate: (params: ViewParams) => void
  onChangeRegion: (region: Region) => void
}

export function HomeView({ region, makers, products, auctions, onNavigate, onChangeRegion }: HomeViewProps) {
  const liveAuction = getLiveAuction(auctions)
  const liveProduct = getProductById(products, liveAuction.productId)
  const countdown = countdownParts(liveAuction.endsAt)
  const now = useNow(1000)
  const reducedMotion = usePrefersReducedMotion()
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    if (reducedMotion || isMobile) {
      return
    }

    const onScroll = () => setOffset(window.scrollY * 0.18)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [isMobile, reducedMotion])

  const makersPreview = useMemo(() => makers.slice(0, 4), [makers])

  return (
    <div className={styles.viewStack}>
      <section className={styles.heroSection}>
        <div
          className={styles.heroImageWrap}
          style={{
            transform: reducedMotion || isMobile ? undefined : `translateY(${offset}px)`
          }}>
          <DemoImage
            src="https://picsum.photos/seed/takumi-hero/1600/960"
            alt="Sunlit gallery-like craft interior with pale surfaces, ceramics, textiles, and daylight."
            className={styles.heroImage}
            loading="eager"
          />
        </div>
        <div className={styles.heroPanel}>
          <p className={styles.eyebrow}>Takumi Market</p>
          <h1 className={styles.displayTitle}>Vetted Japanese craft, shipped to the world.</h1>
          <p className={styles.heroCopy}>
            A bright, commerce-ready marketplace demo where makers control their story, pricing localizes by region, and limited releases can split stock between direct purchase and auction.
          </p>
          <button type="button" className={styles.buttonPrimary} onClick={() => onNavigate({ view: 'marketplace', region })}>
            Explore the Market
          </button>
        </div>
      </section>

      <Reveal className={styles.sectionShell}>
        <div className={styles.regionStrip}>
          <p className={styles.eyebrow}>Region</p>
          <div className={styles.regionPillRow}>
            {REGIONS.map((entry) => (
              <button
                key={entry.code}
                type="button"
                className={`${styles.regionPill} ${entry.code === region ? styles.regionPillActive : ''}`}
                onClick={() => onChangeRegion(entry.code)}>
                {entry.flagLabel} · {entry.label}
              </button>
            ))}
          </div>
        </div>
      </Reveal>

      <section className={styles.sectionShell}>
        <Reveal>
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>Featured Makers</p>
            <h2 className={styles.sectionTitle}>Studio voices, distinct on purpose.</h2>
          </div>
        </Reveal>
        <div className={styles.horizontalScroll}>
          {makersPreview.map((maker, index) => (
            <Reveal key={maker.id} delay={index * 60} className={styles.horizontalCard}>
              <MakerCard maker={maker} onOpen={(id) => onNavigate({ view: 'maker', id, region })} />
            </Reveal>
          ))}
        </div>
      </section>

      <section className={styles.sectionShell}>
        <Reveal>
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>Categories</p>
            <h2 className={styles.sectionTitle}>Browse by craft discipline.</h2>
          </div>
        </Reveal>
        <div className={styles.categoryGrid}>
          {categoryTiles.map((tile, index) => (
            <Reveal key={tile.id} delay={index * 60}>
              <button
                type="button"
                className={styles.categoryTile}
                onClick={() =>
                  onNavigate({
                    view: 'marketplace',
                    category: tile.id,
                    region
                  })
                }>
                <DemoImage
                  src={`https://picsum.photos/seed/${tile.seed}/900/700`}
                  alt={`${tile.label} editorial category image`}
                  className={styles.categoryTileImage}
                />
                <span className={styles.categoryTileLabel}>{tile.label}</span>
              </button>
            </Reveal>
          ))}
        </div>
      </section>

      <section className={`${styles.sectionShell} ${styles.dotGridSection}`}>
        <div className={styles.trustStrip}>
          {trustItems.map((item, index) => (
            <Reveal key={item.label} delay={index * 60} className={styles.trustCard}>
              <item.icon aria-hidden className={styles.trustIcon} />
              <span>{item.label}</span>
            </Reveal>
          ))}
        </div>
      </section>

      {liveProduct ? (
        <section className={styles.sectionShell}>
          <Reveal>
            <div className={styles.auctionTeaser}>
              <div className={styles.auctionTeaserMedia}>
                <DemoImage src={liveProduct.images[0].url} alt={liveProduct.images[0].alt} className={styles.auctionTeaserImage} />
              </div>
              <div className={styles.auctionTeaserBody}>
                <p className={styles.eyebrow}>Live Auction</p>
                <h2 className={styles.sectionTitle}>{liveAuction.title}</h2>
                <p className={styles.bodyCopy}>
                  A limited release with only part of the batch in auction. Remaining stock stays available at fixed price.
                </p>
                <div className={styles.countdownRow}>
                  <span className={styles.countdownChip}>{countdown.hours}</span>
                  <span className={styles.countdownSeparator}>:</span>
                  <span className={styles.countdownChip}>{countdown.minutes}</span>
                  <span className={styles.countdownSeparator}>:</span>
                  <span className={styles.countdownChip}>{countdown.seconds}</span>
                </div>
                <div className={styles.auctionMetaRow}>
                  <div>
                    <p className={styles.metaLabel}>Current bid</p>
                    <AnimatedPrice
                      value={liveAuction.bidHistory[0].amount[region]}
                      region={region}
                      className={styles.highlightPrice}
                    />
                  </div>
                  <div>
                    <p className={styles.metaLabel}>Updated</p>
                    <p className={styles.bodyCopyMuted}>{new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
                <button type="button" className={styles.buttonSecondary} onClick={() => onNavigate({ view: 'auction', id: liveAuction.id, region })}>
                  View Auction
                </button>
              </div>
            </div>
          </Reveal>
        </section>
      ) : null}

      <section className={styles.sectionShell}>
        <Reveal>
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>Fulfillment</p>
            <h2 className={styles.sectionTitle}>Shipping paths from Japan to five regions.</h2>
          </div>
        </Reveal>
        <Reveal>
          <div className={styles.mapCard}>
            <svg viewBox="0 0 640 280" className={styles.fulfillmentMap} aria-label="Fulfillment routes from Japan to global regions">
              <rect x="0" y="0" width="640" height="280" fill="transparent" />
              {routes.map((route) => (
                <path
                  key={route.region}
                  d={`M 190 145 Q ${(190 + route.x) / 2} ${Math.min(route.y, 145) - 25} ${route.x} ${route.y}`}
                  className={`${styles.mapRoute} ${route.region === region ? styles.mapRouteActive : ''}`}
                />
              ))}
              <circle cx="190" cy="145" r="14" className={styles.mapNodeOrigin} />
              <text x="190" y="176" textAnchor="middle" className={styles.mapLabel}>
                Japan
              </text>
              {routes.map((route) => (
                <g key={route.region}>
                  <circle
                    cx={route.x}
                    cy={route.y}
                    r={route.region === region ? 13 : 10}
                    className={`${styles.mapNode} ${route.region === region ? styles.mapNodeActive : ''}`}
                  />
                  <text x={route.x} y={route.y + 24} textAnchor="middle" className={styles.mapLabel}>
                    {route.region}
                  </text>
                </g>
              ))}
            </svg>
            <div className={styles.mapLegend}>
              {REGIONS.map((entry) => (
                <div key={entry.code} className={`${styles.mapLegendRow} ${entry.code === region ? styles.mapLegendRowActive : ''}`}>
                  <span className={styles.mapLegendKey}>{entry.flagLabel}</span>
                  <span>{entry.country}</span>
                  <span>{entry.shippingEta}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  )
}

