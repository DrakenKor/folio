import Link from 'next/link'
import { formatBlogDate } from '@/lib/blog-helpers'
import type { BlogPostMeta } from '@/types/blog'
import { TagBadge } from './TagBadge'

interface PostCardProps {
  post: BlogPostMeta
  activeTagSlug?: string
}

export function PostCard({ post, activeTagSlug }: PostCardProps) {
  return (
    <article className="blog-card">
      <p className="blog-card-date">{formatBlogDate(post.date)}</p>
      <h2 className="blog-card-title">
        <Link href={`/blog/${post.slug}`}>{post.title}</Link>
      </h2>
      <p className="blog-card-description">{post.description}</p>
      <div className="blog-card-tags">
        {post.tags.map((tag, index) => (
          <TagBadge
            key={`${post.slug}-${post.tagSlugs[index]}`}
            label={tag}
            slug={post.tagSlugs[index]}
            active={activeTagSlug === post.tagSlugs[index]}
          />
        ))}
      </div>
      <Link href={`/blog/${post.slug}`} className="blog-card-link">
        Read article
      </Link>
    </article>
  )
}
