export type Region = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'SGD'

export type Category =
  | 'tableware'
  | 'kitchen-tools'
  | 'textiles'
  | 'tea-ritual'
  | 'paper-goods'
  | 'home-objects'

export type StockStatus =
  | 'in-stock'
  | 'low-stock'
  | 'made-to-order'
  | 'sold-out'
  | 'auction-only'

export type DemoView = 'home' | 'marketplace' | 'maker' | 'product' | 'auction' | 'about'

export type SortOption = 'newest' | 'price-asc' | 'price-desc' | 'maker-asc'

export interface RegionalPricing {
  JPY: number
  USD: number
  EUR: number
  GBP: number
  SGD: number
}

export interface ShippingInfo {
  region: Region
  estimatedDays: [number, number]
  cost: number
}

export interface MediaAsset {
  url: string
  alt: string
}

export interface ProcessAsset extends MediaAsset {
  caption: string
}

export interface Milestone {
  year: number
  event: string
}

export interface Maker {
  id: string
  name: string
  location: string
  craft: string
  tagline: string
  accentColor: string
  story: string
  pullQuote: string
  founded: number
  milestones: Milestone[]
  materials: string[]
  techniques: string[]
  heroImage: MediaAsset
  processImages: ProcessAsset[]
  makerNotes: string
  verified: boolean
  verifiedDate: string
  quote: string
  heritage: string
}

export interface Product {
  id: string
  name: string
  makerId: string
  category: Category
  origin: string
  description: string
  story: string
  materials: string[]
  technique: string
  dimensions: string
  weight: string
  care: string
  pricing: RegionalPricing
  shipping: ShippingInfo[]
  stockStatus: StockStatus
  stockCount?: number
  images: MediaAsset[]
  videoUrl?: string
  makerNotes?: string
  auctionId?: string
  collections: string[]
  releaseOrder: number
}

export interface AuctionBidEntry {
  bidderId: string
  amount: RegionalPricing
  amountJPY: number
  createdAt: number
  isUser?: boolean
}

export interface Auction {
  id: string
  productId: string
  title: string
  auctionUnits: number
  totalUnits: number
  startingBid: RegionalPricing
  currentBid: RegionalPricing
  bidHistory: AuctionBidEntry[]
  endsAt: string
  status: 'live' | 'upcoming' | 'ended'
  fairnessRules: string[]
}

export interface Collection {
  id: string
  name: string
  description: string
  productIds: string[]
}

export interface CartItem {
  productId: string
  quantity: number
}

export interface RegionMeta {
  code: Region
  label: string
  country: string
  currencyLabel: string
  symbol: string
  flagLabel: string
  shippingEta: string
  dutiesLabel: string
}

export interface ViewParams {
  view: DemoView
  id?: string
  category?: Category
  sort?: SortOption
  collection?: string
  region?: Region
}

export interface SearchResultGroups {
  products: Product[]
  makers: Maker[]
}

export interface ToastLink {
  label: string
  target: 'cart' | 'view'
  view?: DemoView
  id?: string
  category?: Category
  collection?: string
}

export interface ToastItem {
  id: string
  message: string
  type: 'success' | 'info' | 'neutral'
  link?: ToastLink
}

