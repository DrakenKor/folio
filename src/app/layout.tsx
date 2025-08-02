import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AppInitializer } from '@/components/AppInitializer'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Manav Dhindsa - Interactive Portfolio',
  description:
    'Interactive portfolio showcasing 8+ years of software engineering experience through cutting-edge 3D visualizations, mathematical art, and WebAssembly demonstrations.',
  keywords:
    'software engineer, portfolio, 3D visualization, WebAssembly, React, Three.js, TypeScript',
  authors: [{ name: 'Manav Dhindsa' }],
  openGraph: {
    title: 'Manav Dhindsa - Interactive Portfolio',
    description:
      'Interactive portfolio showcasing advanced web development capabilities',
    type: 'website',
    locale: 'en_US'
  }
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#000000'
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className={inter.className}>
        <AppInitializer>{children}</AppInitializer>
      </body>
    </html>
  )
}
