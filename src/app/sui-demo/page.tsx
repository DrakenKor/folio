import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Noto_Sans_JP, Noto_Serif_JP } from 'next/font/google'
import { SuiDemo } from './SuiDemo'

const serif = Noto_Serif_JP({
  subsets: ['latin'],
  variable: '--sui-serif',
  weight: ['400', '500', '600', '700'],
  display: 'swap'
})

const sans = Noto_Sans_JP({
  subsets: ['latin'],
  variable: '--sui-sans',
  weight: ['400', '500', '700'],
  display: 'swap'
})

export const metadata: Metadata = {
  title: 'salon sui Demo',
  description: 'Interactive salon sui facial salon demo with four visual treatments.',
  alternates: {
    canonical: '/sui-demo'
  }
}

export default function SuiDemoPage() {
  return (
    <Suspense fallback={<div className={`${serif.variable} ${sans.variable}`} style={{ minHeight: '100vh', background: '#fffdf8' }} />}>
      <SuiDemo className={`${serif.variable} ${sans.variable}`} />
    </Suspense>
  )
}
