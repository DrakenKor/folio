'use client'

import { FiCheckCircle } from 'react-icons/fi'
import { Auction, Maker, Product, Region } from '../types'
import { AnimatedPrice, DemoImage } from './shared'
import { CATEGORY_LABELS, getStockLabel, getStockTone } from '../utils'
import styles from '../takumi-market.module.css'

interface ProductCardProps {
  product: Product
  maker: Maker
  region: Region
  auction?: Auction
  onOpenProduct: (productId: string) => void
  onOpenMaker: (makerId: string) => void
}

export function ProductCard({
  product,
  maker,
  region,
  auction,
  onOpenProduct,
  onOpenMaker
}: ProductCardProps) {
  const secondaryImage = product.images[1] ?? product.images[0]

  return (
    <article className={styles.productCard}>
      <button type="button" className={styles.productImageButton} onClick={() => onOpenProduct(product.id)}>
        <div className={styles.productImageFrame}>
          <DemoImage src={product.images[0].url} alt={product.images[0].alt} className={styles.productImageAsset} />
          <DemoImage
            src={secondaryImage.url}
            alt={secondaryImage.alt}
            className={`${styles.productImageAsset} ${styles.productImageSecondary}`}
          />
          <span className={`${styles.stockBadge} ${styles[`stockBadge${capitalize(getStockTone(product, auction))}`]}`}>
            {getStockLabel(product, auction)}
          </span>
          <span className={styles.vettedBadge}>
            <FiCheckCircle aria-hidden />
          </span>
          <span className={styles.storySnippet}>{product.description}</span>
        </div>
      </button>

      <div className={styles.productMeta}>
        <div className={styles.productTopline}>
          <span className={styles.categoryTag}>{CATEGORY_LABELS[product.category]}</span>
          <span className={styles.originLabel}>{product.origin}</span>
        </div>
        <button type="button" className={styles.productTitle} onClick={() => onOpenProduct(product.id)}>
          {product.name}
        </button>
        <button type="button" className={styles.makerLink} onClick={() => onOpenMaker(maker.id)}>
          {maker.name}
        </button>
        <AnimatedPrice value={product.pricing[region]} region={region} className={styles.productPrice} />
      </div>
    </article>
  )
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

