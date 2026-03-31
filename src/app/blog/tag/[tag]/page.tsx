import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PostList } from '@/components/blog/PostList'
import { TagBadge } from '@/components/blog/TagBadge'
import { getAllTags, getPostsByTagSlug, getTagBySlug } from '@/lib/blog'

interface BlogTagPageProps {
  params: Promise<{
    tag: string
  }>
}

export const dynamicParams = false

export function generateStaticParams() {
  return getAllTags().map((tag) => ({
    tag: tag.slug
  }))
}

export async function generateMetadata({
  params
}: BlogTagPageProps): Promise<Metadata> {
  const { tag } = await params
  const currentTag = getTagBySlug(tag)

  if (!currentTag) {
    return {
      title: 'Tag Not Found',
      robots: {
        index: false,
        follow: false
      }
    }
  }

  return {
    title: currentTag.label,
    description: `Posts tagged ${currentTag.label} on the Manav Dhindsa portfolio blog.`,
    alternates: {
      canonical: `/blog/tag/${currentTag.slug}`
    }
  }
}

export default async function BlogTagPage({ params }: BlogTagPageProps) {
  const { tag } = await params
  const currentTag = getTagBySlug(tag)

  if (!currentTag) {
    notFound()
  }

  const posts = getPostsByTagSlug(currentTag.slug)

  if (posts.length === 0) {
    notFound()
  }

  return (
    <section className="blog-tag-page">
      <header className="blog-page-intro">
        <Link href="/blog" className="blog-back-link">
          Back to blog
        </Link>
        <p className="blog-eyebrow">Tag Archive</p>
        <div className="blog-tag-row">
          <TagBadge label={currentTag.label} slug={currentTag.slug} active />
        </div>
        <h1 className="blog-page-title">{currentTag.label}</h1>
        <p className="blog-tag-copy">
          {currentTag.count} post{currentTag.count === 1 ? '' : 's'} collected
          under this topic.
        </p>
      </header>

      <PostList
        posts={posts}
        title="Tagged posts"
        description={`Entries connected to ${currentTag.label}.`}
        activeTagSlug={currentTag.slug}
      />
    </section>
  )
}
