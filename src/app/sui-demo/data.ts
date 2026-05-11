import type {
  ConcernId,
  DesignMeta,
  Intensity,
  Recommendation,
  SalonOption,
  SalonService,
  SkinGoal,
  TimePreference
} from './types'

export const assets = {
  flyerBlue: '/sui/sui pamphlet.jpg',
  flyerWarm: '/sui/sui pamphlet 2.jpg',
  markCard: '/sui/sui 1.png',
  accessCard: '/sui/sui 2.png',
  logo: '/sui-logo.svg'
} as const

export const designs: DesignMeta[] = [
  {
    id: 'botanical-flyer',
    label: 'Botanical Flyer',
    shortLabel: 'Botanical',
    swatch: ['#0b3d78', '#dcebf8', '#b38a3b'],
    source: assets.flyerBlue
  },
  {
    id: 'soft-spa-menu',
    label: 'Soft Spa Menu',
    shortLabel: 'Spa Menu',
    swatch: ['#fbf8f1', '#6f816d', '#153d63'],
    source: assets.flyerWarm
  },
  {
    id: 'consultation-studio',
    label: 'Consultation Studio',
    shortLabel: 'Consult',
    swatch: ['#ffffff', '#1f6da5', '#dcebe3'],
    source: assets.flyerBlue
  },
  {
    id: 'reservation-concierge',
    label: 'Reservation Concierge',
    shortLabel: 'Reserve',
    swatch: ['#073c74', '#fffdfa', '#bd9a4a'],
    source: assets.accessCard
  }
]

export const salon = {
  name: 'salon sui',
  descriptor: '美肌再生ラボ',
  owner: 'Mihoko Sakaki',
  positioning: '上本町の肌質改善フェイシャルサロン',
  focus: 'エレクトロポレーション / エクソソーム導入ケア',
  intro:
    'エレクトロポレーション導入で、うるおい・ツヤ感・キメを整えるケア。肌状態を確認し、お悩みに合わせて施術をご提案します。',
  menuContext: '美容成分を肌の深部へ届け、うるおいと透明感のある肌へ。',
  footnote: '※角質層まで',
  appointment: '完全予約制',
  station: '大阪上本町駅 徒歩3分',
  hours: '10:00-22:00',
  instagram: '@sui.bihadalabo',
  address: '大阪市天王寺区上本町6-9-19 FLAT34 703',
  accessMarkers: ['大阪上本町駅', 'ハイハイタウン', '徒歩3分']
} as const

export const trustPoints = [
  {
    label: '完全予約制でゆったり施術',
    detail: 'Private care'
  },
  {
    label: '大阪上本町駅 徒歩3分',
    detail: 'Uehonmachi'
  },
  {
    label: '10:00-22:00 営業',
    detail: 'Open daily'
  }
]

export const concerns: { id: ConcernId; label: ConcernId; hint: string }[] = [
  { id: '乾燥', label: '乾燥', hint: 'うるおいを重ねたい肌に' },
  { id: 'くすみ印象', label: 'くすみ印象', hint: '明るい印象を目指す方に' },
  { id: 'ハリ不足', label: 'ハリ不足', hint: '弾むような肌印象へ' },
  { id: 'キメの乱れ', label: 'キメの乱れ', hint: 'なめらかな肌印象へ' },
  { id: '手元の乾燥', label: '手元の乾燥', hint: '手肌の集中ケアに' }
]

export const firstTimeOffer = {
  label: '初めての方へ',
  ribbon: 'はじめての方におすすめ',
  title: '初回カウンセリング付き エクソソーム導入体験',
  duration: '45分',
  durationMinutes: 45,
  price: '¥8,800',
  priceValue: 8800,
  note: '肌状態を確認し、お悩みに合わせて施術をご提案します。'
}

export const services: SalonService[] = [
  {
    id: 'high-exosome',
    name: '高濃度エクソソームコース',
    alternateName: '肌質改善エクソソーム導入コース',
    ingredient: 'ヒト幹美容液＋化粧水',
    description: 'うるおいやハリを与え、輝くような肌へ導きます。',
    duration: '30分',
    durationMinutes: 30,
    price: '¥10,000',
    priceValue: 10000,
    idealConcerns: ['くすみ印象', 'キメの乱れ'],
    suggestedOptionId: 'moisture-pack',
    bestFor: '透明感やキメを整えたい方'
  },
  {
    id: 'premium-exosome',
    name: '超濃度エクソソームコース',
    ingredient: 'ヒト幹美容液＋美容液',
    description: '年齢肌や乾燥が気になる方に。弾むような肌へ。',
    duration: '30分',
    durationMinutes: 30,
    price: '¥12,000',
    priceValue: 12000,
    idealConcerns: ['乾燥', 'ハリ不足'],
    suggestedOptionId: 'moisture-pack',
    bestFor: '乾燥やハリ不足を集中的にケアしたい方'
  },
  {
    id: 'hand-care',
    name: '手の甲エクソソームコース',
    ingredient: '美容液',
    description: '手元のハリ・透明感ケアに。若々しい印象の手肌へ。',
    duration: '10分',
    durationMinutes: 10,
    price: '¥5,500',
    priceValue: 5500,
    idealConcerns: ['手元の乾燥'],
    suggestedOptionId: 'moisture-pack',
    bestFor: '手元の乾燥や印象が気になる方'
  }
]

export const options: SalonOption[] = [
  {
    id: 'moisture-pack',
    name: '保湿パック',
    shortName: 'パック',
    duration: '10分',
    durationMinutes: 10,
    price: '¥2,000',
    priceValue: 2000,
    description: '導入ケア後の肌をしっとり整える追加ケア。'
  },
  {
    id: 'eyebrow-cut',
    name: '眉毛カット',
    shortName: '眉毛カット',
    duration: '30分',
    durationMinutes: 30,
    price: '¥2,200',
    priceValue: 2200,
    description: 'フェイシャルとあわせて印象を整える身だしなみオプション。'
  }
]

export const concernRecommendations: Record<ConcernId, Recommendation> = {
  乾燥: {
    serviceId: 'premium-exosome',
    optionIds: ['moisture-pack'],
    note: 'このお悩みには「超濃度エクソソームコース」と「保湿パック」がおすすめです。'
  },
  くすみ印象: {
    serviceId: 'high-exosome',
    optionIds: [],
    note: 'このお悩みには「高濃度エクソソームコース」がおすすめです。'
  },
  ハリ不足: {
    serviceId: 'premium-exosome',
    optionIds: [],
    note: 'このお悩みには「超濃度エクソソームコース」がおすすめです。'
  },
  キメの乱れ: {
    serviceId: 'high-exosome',
    optionIds: [],
    note: 'このお悩みには「高濃度エクソソームコース」がおすすめです。'
  },
  手元の乾燥: {
    serviceId: 'hand-care',
    optionIds: ['moisture-pack'],
    note: 'このお悩みには「手の甲エクソソームコース」と「保湿パック」がおすすめです。'
  }
}

export const intensities: Intensity[] = ['気になる', 'かなり気になる', '集中的にケアしたい']

export const skinGoals: SkinGoal[] = ['うるおい', 'ツヤ感', 'ハリ', '透明感', '手元ケア']

export const timePreferences: TimePreference[] = ['30分以内', '45分まで', 'しっかり']
