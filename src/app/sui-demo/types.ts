export type DesignId = 'botanical-flyer' | 'soft-spa-menu' | 'consultation-studio' | 'reservation-concierge'

export type ServiceId = 'high-exosome' | 'premium-exosome' | 'hand-care'

export type OptionId = 'moisture-pack' | 'eyebrow-cut'

export type ConcernId = '乾燥' | 'くすみ印象' | 'ハリ不足' | 'キメの乱れ' | '手元の乾燥'

export type ContactMethod = 'LINE' | 'Instagram' | 'Access'

export type Intensity = '気になる' | 'かなり気になる' | '集中的にケアしたい'

export type SkinGoal = 'うるおい' | 'ツヤ感' | 'ハリ' | '透明感' | '手元ケア'

export type TimePreference = '30分以内' | '45分まで' | 'しっかり'

export interface DesignMeta {
  id: DesignId
  label: string
  shortLabel: string
  swatch: [string, string, string]
  source: string
}

export interface SalonService {
  id: ServiceId
  name: string
  alternateName?: string
  ingredient: string
  description: string
  duration: string
  durationMinutes: number
  price: string
  priceValue: number
  idealConcerns: ConcernId[]
  suggestedOptionId?: OptionId
  bestFor: string
}

export interface SalonOption {
  id: OptionId
  name: string
  shortName: string
  duration: string
  durationMinutes: number
  price: string
  priceValue: number
  description: string
}

export interface Recommendation {
  serviceId: ServiceId
  optionIds: OptionId[]
  note: string
}
