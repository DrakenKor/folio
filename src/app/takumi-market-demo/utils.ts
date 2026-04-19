import {
  Auction,
  AuctionBidEntry,
  Category,
  Collection,
  DemoView,
  Maker,
  Product,
  Region,
  SearchResultGroups,
  ShippingInfo,
  SortOption,
  ViewParams
} from './types'
import { REGION_META, convertJPY, convertRegional } from './data/regions'

export const CATEGORY_LABELS: Record<Category, string> = {
  tableware: 'Tableware',
  'kitchen-tools': 'Kitchen Tools',
  textiles: 'Textiles',
  'tea-ritual': 'Tea Ritual',
  'paper-goods': 'Paper Goods',
  'home-objects': 'Home Objects'
}

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price Low→High' },
  { value: 'price-desc', label: 'Price High→Low' },
  { value: 'maker-asc', label: 'Maker A→Z' }
]

export const AUCTION_INCREMENTS: Record<Region, number[]> = {
  USD: [10, 25, 50],
  EUR: [10, 20, 40],
  GBP: [10, 20, 40],
  JPY: [1000, 2500, 5000],
  SGD: [15, 35, 70]
}

export function formatPrice(value: number, region: Region) {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency: region,
    maximumFractionDigits: region === 'JPY' ? 0 : 0
  }).format(value)
}

export function formatPlainNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

export function formatShipping(info: ShippingInfo, region: Region) {
  return `${REGION_META[region].flagLabel} ${info.estimatedDays[0]}-${info.estimatedDays[1]} days`
}

export function getProductPrice(product: Product, region: Region) {
  return product.pricing[region]
}

export function getAuctionCurrentBid(auction: Auction, bids?: AuctionBidEntry[]) {
  const history = bids ?? auction.bidHistory
  return history[0]?.amount ?? auction.currentBid
}

export function getAuctionCurrentBidJPY(auction: Auction, bids?: AuctionBidEntry[]) {
  const history = bids ?? auction.bidHistory
  return history[0]?.amountJPY ?? auction.currentBid.JPY
}

export function getAuctionMinimumBid(auction: Auction, region: Region, bids?: AuctionBidEntry[]) {
  const current = getAuctionCurrentBid(auction, bids)[region]
  const increment = AUCTION_INCREMENTS[region][0]
  return current + increment
}

export function convertRegionAmountToJPY(amount: number, region: Region) {
  return region === 'JPY' ? amount : Math.round(amount / getConversionRate(region))
}

function getConversionRate(region: Region) {
  return convertJPY(1000, region) / 1000
}

export function toRegionalPricing(amountJPY: number) {
  return {
    JPY: convertJPY(amountJPY, 'JPY'),
    USD: convertJPY(amountJPY, 'USD'),
    EUR: convertJPY(amountJPY, 'EUR'),
    GBP: convertJPY(amountJPY, 'GBP'),
    SGD: convertJPY(amountJPY, 'SGD')
  }
}

export function formatRelativeTime(createdAt: number, now = Date.now()) {
  const diff = Math.max(0, now - createdAt)
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) {
    return 'just now'
  }
  if (minutes < 60) {
    return `${minutes} min ago`
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours} hr ago`
  }
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export function sanitizeRegion(region: string | null | undefined): Region {
  if (region === 'EUR' || region === 'GBP' || region === 'JPY' || region === 'SGD') {
    return region
  }
  return 'USD'
}

export function sanitizeView(view: string | null | undefined): DemoView {
  switch (view) {
    case 'marketplace':
    case 'maker':
    case 'product':
    case 'auction':
    case 'about':
      return view
    default:
      return 'home'
  }
}

export function sanitizeSort(sort: string | null | undefined): SortOption {
  switch (sort) {
    case 'price-asc':
    case 'price-desc':
    case 'maker-asc':
      return sort
    default:
      return 'newest'
  }
}

export function sanitizeCategory(category: string | null | undefined): Category | undefined {
  switch (category) {
    case 'tableware':
    case 'kitchen-tools':
    case 'textiles':
    case 'tea-ritual':
    case 'paper-goods':
    case 'home-objects':
      return category
    default:
      return undefined
  }
}

export function buildDemoQuery(params: ViewParams) {
  const search = new URLSearchParams()
  if (params.view !== 'home') {
    search.set('view', params.view)
  }
  if (params.id) {
    search.set('id', params.id)
  }
  if (params.category) {
    search.set('category', params.category)
  }
  if (params.sort && params.sort !== 'newest') {
    search.set('sort', params.sort)
  }
  if (params.collection) {
    search.set('collection', params.collection)
  }
  search.set('region', params.region ?? 'USD')
  const query = search.toString()
  return query ? `?${query}` : ''
}

export function getViewLabel(view: DemoView) {
  switch (view) {
    case 'home':
      return 'Home'
    case 'marketplace':
      return 'Marketplace'
    case 'maker':
      return 'Maker'
    case 'product':
      return 'Product'
    case 'auction':
      return 'Auction'
    case 'about':
      return 'About'
  }
}

export function getMakerById(makers: Maker[], id?: string | null) {
  return makers.find((maker) => maker.id === id)
}

export function getProductById(products: Product[], id?: string | null) {
  return products.find((product) => product.id === id)
}

export function getAuctionById(auctions: Auction[], id?: string | null) {
  return auctions.find((auction) => auction.id === id)
}

export function sortProducts(products: Product[], region: Region, sort: SortOption, makersById: Record<string, Maker>) {
  const list = [...products]
  switch (sort) {
    case 'price-asc':
      return list.sort((a, b) => a.pricing[region] - b.pricing[region])
    case 'price-desc':
      return list.sort((a, b) => b.pricing[region] - a.pricing[region])
    case 'maker-asc':
      return list.sort((a, b) => makersById[a.makerId].name.localeCompare(makersById[b.makerId].name))
    case 'newest':
    default:
      return list.sort((a, b) => a.releaseOrder - b.releaseOrder)
  }
}

export function filterProducts(
  products: Product[],
  selectedCategory: Category | undefined,
  selectedCollection: Collection | undefined
) {
  return products.filter((product) => {
    const categoryMatch = selectedCategory ? product.category === selectedCategory : true
    const collectionMatch = selectedCollection ? selectedCollection.productIds.includes(product.id) : true
    return categoryMatch && collectionMatch
  })
}

export function searchCatalog(products: Product[], makers: Maker[], query: string): SearchResultGroups {
  const normalized = query.trim().toLowerCase()
  if (!normalized) {
    return { products: [], makers: [] }
  }

  const productResults = products
    .filter((product) => {
      const maker = makers.find((entry) => entry.id === product.makerId)
      const haystack = [
        product.name,
        product.origin,
        product.description,
        product.category,
        product.materials.join(' '),
        maker?.name ?? '',
        maker?.craft ?? ''
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(normalized)
    })
    .slice(0, 5)

  const makerResults = makers
    .filter((maker) => {
      const haystack = [maker.name, maker.location, maker.craft, maker.materials.join(' '), maker.techniques.join(' ')]
        .join(' ')
        .toLowerCase()
      return haystack.includes(normalized)
    })
    .slice(0, 5)

  return { products: productResults, makers: makerResults }
}

export function getStockLabel(product: Product, auction?: Auction) {
  if (auction?.status === 'live') {
    return 'Auction Live'
  }
  switch (product.stockStatus) {
    case 'in-stock':
      return 'In Stock'
    case 'low-stock':
      return 'Low Stock'
    case 'made-to-order':
      return 'Made to Order'
    case 'sold-out':
      return 'Sold Out'
    case 'auction-only':
      return 'Auction Only'
  }
}

export function getStockTone(product: Product, auction?: Auction) {
  if (auction?.status === 'live') {
    return 'amber'
  }
  switch (product.stockStatus) {
    case 'sold-out':
      return 'gray'
    case 'made-to-order':
      return 'sky'
    case 'low-stock':
      return 'coral'
    default:
      return 'green'
  }
}

export function countdownParts(endsAt: string) {
  const diff = Math.max(0, new Date(endsAt).getTime() - Date.now())
  const totalSeconds = Math.floor(diff / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return {
    totalSeconds,
    hours: String(hours).padStart(2, '0'),
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds).padStart(2, '0')
  }
}

export function clampQuantity(quantity: number) {
  return Math.min(5, Math.max(1, quantity))
}

export function shippingForRegion(shipping: ShippingInfo[], region: Region) {
  return shipping.find((entry) => entry.region === region) ?? shipping[0]
}

export function sumSubtotal(products: Product[], cart: { productId: string; quantity: number }[], region: Region) {
  return cart.reduce((sum, item) => {
    const product = products.find((entry) => entry.id === item.productId)
    if (!product) {
      return sum
    }
    return sum + product.pricing[region] * item.quantity
  }, 0)
}

export function sumShipping(products: Product[], cart: { productId: string; quantity: number }[], region: Region) {
  return cart.reduce((sum, item) => {
    const product = products.find((entry) => entry.id === item.productId)
    if (!product) {
      return sum
    }
    return sum + shippingForRegion(product.shipping, region).cost
  }, 0)
}

export function dutiesEstimate(subtotal: number) {
  return Math.round(subtotal * 0.08)
}

export function getLiveAuction(auctions: Auction[]) {
  return auctions.find((auction) => auction.status === 'live') ?? auctions[0]
}

export function maybeEnded(auction: Auction) {
  return countdownParts(auction.endsAt).totalSeconds <= 0 ? 'ended' : auction.status
}

export function randomBidderId() {
  return `Bidder #${Math.floor(Math.random() * 80) + 10}`
}

export function nextBidAmount(currentJPY: number) {
  const increments = [800, 1200, 1800, 2500]
  return currentJPY + increments[Math.floor(Math.random() * increments.length)]
}

export function convertBetweenRegions(amount: number, from: Region, to: Region) {
  return convertRegional(amount, from, to)
}

