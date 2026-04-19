import { Region, RegionMeta, RegionalPricing, ShippingInfo } from '../types'

export const REGION_META: Record<Region, RegionMeta> = {
  JPY: {
    code: 'JPY',
    label: 'JPY',
    country: 'Japan',
    currencyLabel: 'Japanese Yen',
    symbol: '¥',
    flagLabel: 'JP',
    shippingEta: '1-3 days',
    dutiesLabel: 'Domestic shipping, no import duties'
  },
  USD: {
    code: 'USD',
    label: 'USD',
    country: 'United States',
    currencyLabel: 'US Dollar',
    symbol: '$',
    flagLabel: 'US',
    shippingEta: '7-14 days',
    dutiesLabel: 'Import duties may apply in the United States'
  },
  EUR: {
    code: 'EUR',
    label: 'EUR',
    country: 'Europe',
    currencyLabel: 'Euro',
    symbol: '€',
    flagLabel: 'EU',
    shippingEta: '10-18 days',
    dutiesLabel: 'Import duties may apply in Europe'
  },
  GBP: {
    code: 'GBP',
    label: 'GBP',
    country: 'United Kingdom',
    currencyLabel: 'British Pound',
    symbol: '£',
    flagLabel: 'UK',
    shippingEta: '10-16 days',
    dutiesLabel: 'Import duties may apply in the United Kingdom'
  },
  SGD: {
    code: 'SGD',
    label: 'SGD',
    country: 'Singapore',
    currencyLabel: 'Singapore Dollar',
    symbol: 'S$',
    flagLabel: 'SG',
    shippingEta: '5-10 days',
    dutiesLabel: 'Import duties may apply in Singapore'
  }
}

export const REGIONS = Object.values(REGION_META)

const conversionRates: Record<Region, number> = {
  JPY: 1,
  USD: 0.0067,
  EUR: 0.0062,
  GBP: 0.0053,
  SGD: 0.0091
}

const roundingStep: Record<Region, number> = {
  JPY: 100,
  USD: 1,
  EUR: 1,
  GBP: 1,
  SGD: 1
}

function roundForRegion(value: number, region: Region) {
  const step = roundingStep[region]
  return Math.max(step, Math.round(value / step) * step)
}

export function convertJPY(valueJPY: number, region: Region) {
  return roundForRegion(valueJPY * conversionRates[region], region)
}

export function convertRegional(value: number, region: Region, target: Region) {
  if (region === target) {
    return value
  }

  const jpy = region === 'JPY' ? value : value / conversionRates[region]
  return convertJPY(jpy, target)
}

export function createPricing(baseJPY: number): RegionalPricing {
  return {
    JPY: roundForRegion(baseJPY, 'JPY'),
    USD: convertJPY(baseJPY, 'USD'),
    EUR: convertJPY(baseJPY, 'EUR'),
    GBP: convertJPY(baseJPY, 'GBP'),
    SGD: convertJPY(baseJPY, 'SGD')
  }
}

export function createShipping(costJPY: number, daysByRegion: Record<Region, [number, number]>): ShippingInfo[] {
  return REGIONS.map((region) => ({
    region: region.code,
    estimatedDays: daysByRegion[region.code],
    cost: convertJPY(costJPY, region.code)
  }))
}

