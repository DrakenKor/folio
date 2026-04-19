'use client'

import { Auction, Maker, Product, Region, ViewParams } from '../../types'
import { ProductCard } from '../ProductCard'
import { DemoImage, Reveal } from '../shared'
import styles from '../../takumi-market.module.css'

interface MakerViewProps {
  maker: Maker
  products: Product[]
  auctions: Auction[]
  region: Region
  onNavigate: (params: ViewParams) => void
}

export function MakerView({ maker, products, auctions, region, onNavigate }: MakerViewProps) {
  const storyParagraphs = maker.story.split('\n\n')
  const makerProducts = products.filter((product) => product.makerId === maker.id)

  return (
    <div className={styles.viewStack} style={{ ['--maker-accent' as string]: maker.accentColor }}>
      <section className={styles.makerHero}>
        <DemoImage src={maker.heroImage.url} alt={maker.heroImage.alt} className={styles.makerHeroImage} loading="eager" />
        <div className={styles.makerHeroOverlay}>
          <span className={styles.curatedLabel}>Maker Curated</span>
          <p className={styles.eyebrow}>{maker.craft}</p>
          <h1 className={styles.displayTitle}>{maker.name}</h1>
          <p className={styles.bodyCopy}>{maker.location}</p>
          <p className={styles.heroCopy}>{maker.tagline}</p>
        </div>
      </section>

      <section className={styles.sectionShell}>
        <Reveal>
          <div className={styles.storyGrid}>
            <div className={styles.storyColumn}>
              <p className={styles.eyebrow}>Studio Story</p>
              {storyParagraphs.map((paragraph) => (
                <p key={paragraph} className={styles.bodyCopy}>
                  {paragraph}
                </p>
              ))}
            </div>
            <blockquote className={styles.pullQuote}>“{maker.pullQuote}”</blockquote>
          </div>
        </Reveal>
      </section>

      <section className={styles.sectionShell}>
        <Reveal>
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>Process Gallery</p>
            <h2 className={styles.sectionTitle}>How the studio shapes its work.</h2>
          </div>
        </Reveal>
        <div className={styles.horizontalScroll}>
          {maker.processImages.map((image, index) => (
            <Reveal key={image.url} delay={index * 60} className={styles.processCard}>
              <DemoImage src={image.url} alt={image.alt} className={styles.processImage} />
              <p className={styles.processCaption}>{image.caption}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className={styles.sectionShell}>
        <div className={styles.makerDetailGrid}>
          <Reveal>
            <div className={styles.timelineCard}>
              <p className={styles.eyebrow}>Milestones</p>
              <div className={styles.timelineList}>
                {maker.milestones.map((milestone) => (
                  <div key={`${milestone.year}-${milestone.event}`} className={styles.timelineItem}>
                    <span className={styles.timelineYear}>{milestone.year}</span>
                    <span className={styles.timelineEvent}>{milestone.event}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal>
            <div className={styles.materialsCard}>
              <p className={styles.eyebrow}>Materials & Techniques</p>
              <div className={styles.tagCloud}>
                {[...maker.materials, ...maker.techniques].map((item) => (
                  <span key={item} className={styles.accentTag}>
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
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>Product Collection</p>
            <h2 className={styles.sectionTitle}>Objects from this studio.</h2>
          </div>
        </Reveal>
        <div className={styles.marketplaceGrid}>
          {makerProducts.map((product, index) => (
            <Reveal key={product.id} delay={index * 50}>
              <ProductCard
                product={product}
                maker={maker}
                region={region}
                auction={auctions.find((auction) => auction.id === product.auctionId)}
                onOpenProduct={(id) => onNavigate({ view: 'product', id, region })}
                onOpenMaker={(id) => onNavigate({ view: 'maker', id, region })}
              />
            </Reveal>
          ))}
        </div>
      </section>

      <section className={styles.sectionShell}>
        <div className={styles.locationGrid}>
          <Reveal>
            <div className={styles.locationCard}>
              <p className={styles.eyebrow}>Studio Location</p>
              <h2 className={styles.sectionTitle}>
                <span className={styles.locationPin}>
                  <span className={styles.locationDot} />
                </span>
                {maker.location}
              </h2>
              <p className={styles.bodyCopy}>{maker.heritage}</p>
            </div>
          </Reveal>
          <Reveal>
            <div className={styles.noteCard}>
              <p className={styles.eyebrow}>Maker Notes</p>
              <p className={styles.handwrittenNote}>{maker.makerNotes}</p>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  )
}

