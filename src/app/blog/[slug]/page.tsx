import type { Metadata } from 'next'
import Link from 'next/link'
import { MDXRemote } from 'next-mdx-remote/rsc'
import { notFound } from 'next/navigation'
import { TagBadge } from '@/components/blog/TagBadge'
import { mdxComponents } from '@/components/mdx'
import { getAdjacentPosts, getAllPostMeta, getPostBySlug } from '@/lib/blog'
import { formatBlogDate } from '@/lib/blog-helpers'

interface BlogPostPageProps {
  params: Promise<{
    slug: string
  }>
}

export const dynamicParams = false

export function generateStaticParams() {
  return getAllPostMeta().map((post) => ({
    slug: post.slug
  }))
}

export async function generateMetadata({
  params
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params
  const post = getPostBySlug(slug)

  if (!post) {
    return {
      title: 'Post Not Found',
      robots: {
        index: false,
        follow: false
      }
    }
  }

  return {
    title: post.title,
    description: post.description,
    keywords: post.tags,
    alternates: {
      canonical: `/blog/${post.slug}`
    },
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      url: `/blog/${post.slug}`
    }
  }
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params
  const post = getPostBySlug(slug)

  if (!post) {
    notFound()
  }

  const adjacentPosts = getAdjacentPosts(post.slug)

  return (
    <article className="blog-post-page">
      <header className="blog-post-header">
        <Link href="/blog" className="blog-back-link">
          Back to blog
        </Link>
        <p className="blog-post-meta">{formatBlogDate(post.date)}</p>
        <h1 className="blog-post-title">{post.title}</h1>
        <p className="blog-post-description">{post.description}</p>
        <div className="blog-post-tag-row">
          {post.tags.map((tag, index) => (
            <TagBadge
              key={`${post.slug}-${post.tagSlugs[index]}`}
              label={tag}
              slug={post.tagSlugs[index]}
            />
          ))}
        </div>
      </header>

      <div className="blog-prose">
        <MDXRemote source={post.content} components={mdxComponents} />
      </div>

      <nav className="blog-adjacent-nav" aria-label="Adjacent posts">
        {adjacentPosts.previous ? (
          <Link href={`/blog/${adjacentPosts.previous.slug}`}>
            <span className="blog-adjacent-label">Newer Post</span>
            <span>{adjacentPosts.previous.title}</span>
          </Link>
        ) : null}

        {adjacentPosts.next ? (
          <Link href={`/blog/${adjacentPosts.next.slug}`}>
            <span className="blog-adjacent-label">Older Post</span>
            <span>{adjacentPosts.next.title}</span>
          </Link>
        ) : null}
      </nav>
    </article>
  )
}
