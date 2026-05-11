import { concernRecommendations, designs, options, services } from './data'
import type { ConcernId, DesignId, Intensity, OptionId, Recommendation, ServiceId, SkinGoal, TimePreference } from './types'

export const defaultDesignId: DesignId = 'botanical-flyer'

export function isDesignId(value: string | null): value is DesignId {
  return designs.some((design) => design.id === value)
}

export function sanitizeDesign(value: string | null): DesignId {
  return isDesignId(value) ? value : defaultDesignId
}

export function getServiceById(id: ServiceId) {
  return services.find((service) => service.id === id) ?? services[0]
}

export function getOptionById(id: OptionId) {
  return options.find((option) => option.id === id) ?? options[0]
}

export function getConcernRecommendation(concern: ConcernId): Recommendation {
  return concernRecommendations[concern]
}

export function getConsultationRecommendation(params: {
  concern: ConcernId
  intensity: Intensity
  goal: SkinGoal
  timePreference: TimePreference
}): Recommendation {
  const { concern, intensity, goal, timePreference } = params
  const optionIds: OptionId[] = []
  let serviceId: ServiceId = concernRecommendations[concern].serviceId

  if (concern === '手元の乾燥' || goal === '手元ケア') {
    serviceId = 'hand-care'
  } else if ((concern === '乾燥' || concern === 'ハリ不足' || goal === 'ハリ') && intensity === '集中的にケアしたい') {
    serviceId = 'premium-exosome'
  } else if (concern === 'くすみ印象' || concern === 'キメの乱れ' || goal === '透明感') {
    serviceId = 'high-exosome'
  }

  if (timePreference !== '30分以内' && (concern === '乾燥' || concern === '手元の乾燥' || goal === 'うるおい')) {
    optionIds.push('moisture-pack')
  }

  const service = getServiceById(serviceId)
  const optionNames = optionIds.map((optionId) => getOptionById(optionId).name)
  const planName = optionNames.length > 0 ? `${service.name}＋${optionNames.join('＋')}` : service.name

  return {
    serviceId,
    optionIds,
    note: `このお悩みには「${planName}」がおすすめです。`
  }
}

export function formatYen(value: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0
  })
    .format(value)
    .replace('￥', '¥')
}

export function totals(serviceId: ServiceId, optionIds: OptionId[]) {
  const service = getServiceById(serviceId)
  const selectedOptions = optionIds.map(getOptionById)

  return selectedOptions.reduce(
    (summary, option) => ({
      durationMinutes: summary.durationMinutes + option.durationMinutes,
      priceValue: summary.priceValue + option.priceValue
    }),
    {
      durationMinutes: service.durationMinutes,
      priceValue: service.priceValue
    }
  )
}

export function optionKey(optionIds: OptionId[]): string {
  return optionIds.slice().sort().join(',')
}
