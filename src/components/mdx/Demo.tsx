'use client'

import Link from 'next/link'
import { demoByName } from '@/lib/demos'

interface DemoProps {
  // A registry slug, or one of the names published posts already use
  name: string
}

export function Demo({ name }: DemoProps) {
  const demo = demoByName(name)

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
      <p className="blog-demo-copy">{demo.line}</p>
      <Link href={demo.route} className="blog-demo-link">
        Open the live route
      </Link>
    </div>
  )
}
