import type { Metadata } from 'next'
import { ScrollProgress } from '@/components/blog/ScrollProgress'
import './blog.css'

export const metadata: Metadata = {
  title: {
    default: 'Blog | Manav Dhindsa',
    template: '%s | Blog | Manav Dhindsa'
  },
  description:
    'Writing on various topics.'
}

export default function BlogLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <div className="blog-shell">
      <ScrollProgress />
      <div className="blog-shell-inner">{children}</div>
    </div>
  )
}
