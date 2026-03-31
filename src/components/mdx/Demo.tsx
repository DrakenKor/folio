'use client'

import Link from 'next/link'

const demoRegistry = {
  'shader-playground': {
    title: 'Shader Art Playground',
    description: 'GPU-powered visual effects and shader experiments from the live demo.',
    href: '/shader-demo'
  },
  'wasm-image-processing': {
    title: 'WASM Image Processing',
    description: 'Static-export-friendly image filters running on WebAssembly.',
    href: '/image-processing-demo'
  },
  'wasm-core': {
    title: 'WASM Core Demo',
    description: 'Core WebAssembly loading and performance checks in the portfolio.',
    href: '/wasm-demo'
  }
} as const

interface DemoProps {
  name: keyof typeof demoRegistry | string
}

export function Demo({ name }: DemoProps) {
  const demo = demoRegistry[name as keyof typeof demoRegistry]

  if (!demo) {
    return (
      <div className="blog-demo-card">
        <p className="blog-demo-eyebrow">Demo</p>
        <p className="blog-demo-title">{name}</p>
        <p className="blog-demo-copy">
          This MDX embed name is not registered in the curated demo map yet.
        </p>
      </div>
    )
  }

  return (
    <div className="blog-demo-card">
      <p className="blog-demo-eyebrow">Interactive Demo</p>
      <p className="blog-demo-title">{demo.title}</p>
      <p className="blog-demo-copy">{demo.description}</p>
      <Link href={demo.href} className="blog-demo-link">
        Open the live route
      </Link>
    </div>
  )
}
