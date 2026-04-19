import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Cormorant_Garamond, Outfit } from 'next/font/google'
import { TakumiMarketDemo } from './TakumiMarketDemo'

const serif = Cormorant_Garamond({
  subsets: ['latin'],
  variable: '--takumi-serif',
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic']
})

const sans = Outfit({
  subsets: ['latin'],
  variable: '--takumi-sans',
  weight: ['300', '400', '500', '600']
})

export const metadata: Metadata = {
  title: 'Takumi Market Demo',
  description: 'Bright editorial marketplace demo for vetted Japanese craftspeople.',
  alternates: {
    canonical: '/takumi-market-demo'
  }
}

export default function TakumiMarketDemoPage() {
  return (
    <Suspense fallback={<div className={`${serif.variable} ${sans.variable}`} style={{ minHeight: '100vh', background: '#fff' }} />}>
      <TakumiMarketDemo className={`${serif.variable} ${sans.variable}`} />
    </Suspense>
  )
}

