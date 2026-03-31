import type { Metadata } from 'next'
import Link from 'next/link'
import { BlogIndexClient } from '@/components/blog/BlogIndexClient'
import { getAllPostMeta, getAllTags } from '@/lib/blog'

export const metadata: Metadata = {
  description:
    'Writing on various topics.',
  alternates: {
    canonical: '/blog'
  }
}

export default function BlogIndexPage() {
  const posts = getAllPostMeta()
  const tags = getAllTags()

  return (
    <section>
      <header className="blog-page-intro">
        <Link href="/" className="blog-back-link">
          Back to portfolio
        </Link>
        <p className="blog-eyebrow">Writing</p>
        <h1 className="blog-page-title">Writing for dynamic work.</h1>
        <p className="blog-page-copy">
          My writing.
        </p>
      </header>

      <BlogIndexClient posts={posts} tags={tags} />
    </section>
  )
}
