'use client'

import { useEffect, useMemo, useState } from 'react'
import { FiChevronDown } from 'react-icons/fi'
import { Auction, AuctionBidEntry, Maker, Product, Region, ViewParams } from '../../types'
import { AUCTION_INCREMENTS, countdownParts, formatRelativeTime, getAuctionCurrentBid, getAuctionCurrentBidJPY, getAuctionMinimumBid, nextBidAmount } from '../../utils'
import { AnimatedPrice, DemoImage, Reveal, VisuallyHidden, useAnnouncementClock, useNow } from '../shared'
import { ProductCard } from '../ProductCard'
import styles from '../../takumi-market.module.css'

interface AuctionViewProps {
  auction: Auction
  product: Product
  maker: Maker
  bids: AuctionBidEntry[]
  relatedProducts: Product[]
  region: Region
  onNavigate: (params: ViewParams) => void
  onPlaceBid: (auction: Auction, amountJPY: number) => void
  onSimulateBid: (auctionId: string, amountJPY: number) => void
}

export function AuctionView({
  auction,
  product,
  maker,
  bids,
  relatedProducts,
  region,
  onNavigate,
  onPlaceBid,
  onSimulateBid
}: AuctionViewProps) {
  const [pendingBid, setPendingBid] = useState<number | null>(null)
  const [rulesOpen, setRulesOpen] = useState(false)
  const now = useNow(1000)
  const announcementClock = useAnnouncementClock()
  const countdown = countdownParts(auction.endsAt)
  const ended = countdown.totalSeconds <= 0
  const currentBid = getAuctionCurrentBid(auction, bids)
  const currentBidJPY = getAuctionCurrentBidJPY(auction, bids)
  const winningBid = bids[0] ?? auction.bidHistory[0]

  useEffect(() => {
    if (ended || auction.status !== 'live') {
      return
    }

    const delay = 15000 + Math.floor(Math.random() * 15000)
    const timeout = window.setTimeout(() => {
      onSimulateBid(auction.id, nextBidAmount(currentBidJPY))
    }, delay)
    return () => window.clearTimeout(timeout)
  }, [auction.id, auction.status, currentBidJPY, ended, onSimulateBid])

  const increments = AUCTION_INCREMENTS[region]
  const confirmationPrice = useMemo(
    () => (pendingBid ? <AnimatedPrice value={pendingBid} region={region} /> : null),
    [pendingBid, region]
  )

  return (
    <div className={styles.viewStack}>
      <section className={styles.sectionShell}>
        <div className={styles.auctionHero}>
          <Reveal>
            <DemoImage src={product.images[0].url} alt={product.images[0].alt} className={styles.auctionHeroImage} loading="eager" />
          </Reveal>
          <Reveal>
            <div className={styles.auctionHeroBody}>
              <p className={styles.eyebrow}>Auction Release</p>
              <h1 className={styles.sectionTitle}>{auction.title}</h1>
              <p className={styles.bodyCopy}>{product.name}</p>
              <div className={`${styles.countdownRow} ${countdown.totalSeconds < 60 ? styles.countdownRowUrgent : ''}`}>
                <span className={styles.countdownChip}>{countdown.hours}</span>
                <span className={styles.countdownSeparator}>:</span>
                <span className={styles.countdownChip}>{countdown.minutes}</span>
                <span className={styles.countdownSeparator}>:</span>
                <span className={styles.countdownChip}>{countdown.seconds}</span>
              </div>
              <div aria-live="polite">
                <VisuallyHidden>
                  {announcementClock ? `Auction update: ${countdown.hours} hours, ${countdown.minutes} minutes remaining.` : ''}
                </VisuallyHidden>
              </div>
              {ended ? (
                <div className={styles.auctionEndedBanner}>
                  <strong>This auction has ended.</strong>
                  <span>
                    Final price <AnimatedPrice value={currentBid[region]} region={region} /> · Winner: {winningBid?.bidderId ?? 'Bidder #47'}
                  </span>
                </div>
              ) : null}
            </div>
          </Reveal>
        </div>
      </section>

      <section className={styles.sectionShell}>
        <div className={styles.auctionLayout}>
          <Reveal>
            <div className={styles.auctionPanel}>
              <p className={styles.metaLabel}>Current bid</p>
              <AnimatedPrice value={currentBid[region]} region={region} className={styles.heroPrice} />
              <p className={styles.bodyCopyMuted}>Minimum next bid: <AnimatedPrice value={getAuctionMinimumBid(auction, region, bids)} region={region} /></p>
              <div className={styles.bidIncrementRow}>
                {increments.map((increment) => (
                  <button
                    key={increment}
                    type="button"
                    className={styles.incrementButton}
                    disabled={ended}
                    onClick={() => setPendingBid(currentBid[region] + increment)}>
                    +{increment}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={styles.buttonSecondary}
                onClick={() => setPendingBid(getAuctionMinimumBid(auction, region, bids))}
                disabled={ended}>
                Place minimum bid
              </button>

              <div className={styles.inventorySplitCard}>
                <p className={styles.bodyCopy}>
                  {auction.auctionUnits} of {auction.totalUnits} units in this auction · {auction.totalUnits - auction.auctionUnits} available at fixed price.
                </p>
                <button type="button" className={styles.inlineAction} onClick={() => onNavigate({ view: 'product', id: product.id, region })}>
                  Buy at fixed price
                </button>
              </div>

              <div className={styles.collapseCard}>
                <button
                  type="button"
                  className={styles.collapseButton}
                  aria-expanded={rulesOpen}
                  onClick={() => setRulesOpen((value) => !value)}>
                  Fairness Rules
                  <FiChevronDown aria-hidden className={rulesOpen ? styles.chevronOpen : ''} />
                </button>
                {rulesOpen ? (
                  <div className={styles.collapseBody}>
                    {auction.fairnessRules.map((rule) => (
                      <p key={rule} className={styles.bodyCopyMuted}>
                        {rule}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </Reveal>

          <Reveal>
            <div className={styles.bidLadderPanel}>
              <p className={styles.eyebrow}>Bid Ladder</p>
              <div className={styles.bidLadder}>
                {bids.slice(0, 10).map((bid) => (
                  <div key={`${bid.bidderId}-${bid.createdAt}`} className={`${styles.bidRow} ${bid.isUser ? styles.bidRowUser : ''}`}>
                    <div>
                      <AnimatedPrice value={bid.amount[region]} region={region} className={styles.bidAmount} />
                      <p className={styles.bodyCopyMuted}>{bid.bidderId}</p>
                    </div>
                    <span className={styles.bodyCopyMuted}>{formatRelativeTime(bid.createdAt, now)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className={styles.sectionShell}>
        <Reveal>
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>Related Direct Purchase Items</p>
            <h2 className={styles.sectionTitle}>Buy now while the auction runs.</h2>
          </div>
        </Reveal>
        <div className={styles.marketplaceGrid}>
          {relatedProducts.slice(0, 4).map((related, index) => (
            <Reveal key={related.id} delay={index * 60}>
              <ProductCard
                product={related}
                maker={maker}
                region={region}
                onOpenProduct={(id) => onNavigate({ view: 'product', id, region })}
                onOpenMaker={(id) => onNavigate({ view: 'maker', id, region })}
              />
            </Reveal>
          ))}
        </div>
      </section>

      {pendingBid !== null ? (
        <div className={styles.modalOverlay}>
          <button type="button" className={styles.overlayBackdrop} aria-label="Cancel bid" onClick={() => setPendingBid(null)} />
          <div className={styles.bidConfirmModal} role="dialog" aria-modal="true" aria-label="Confirm bid">
            <p className={styles.eyebrow}>Confirm Bid</p>
            <h2 className={styles.sectionTitle}>Place bid of {confirmationPrice}?</h2>
            <p className={styles.bodyCopyMuted}>This is a demo action. The bid ladder will update immediately.</p>
            <div className={styles.modalActionRow}>
              <button type="button" className={styles.buttonGhost} onClick={() => setPendingBid(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.buttonPrimary}
                onClick={() => {
                  onPlaceBid(auction, pendingBid === null ? currentBidJPY : pendingBidToJPY(pendingBid, region))
                  setPendingBid(null)
                }}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function pendingBidToJPY(amount: number, region: Region) {
  if (region === 'JPY') {
    return amount
  }

  const rateMap: Record<Exclude<Region, 'JPY'>, number> = {
    USD: 0.0067,
    EUR: 0.0062,
    GBP: 0.0053,
    SGD: 0.0091
  }

  return Math.round(amount / rateMap[region])
}

