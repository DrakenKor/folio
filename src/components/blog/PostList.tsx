import type { BlogPostMeta } from '@/types/blog'
import { PostCard } from './PostCard'

interface PostListProps {
  posts: BlogPostMeta[]
  title?: string
  description?: string
  emptyMessage?: string
  activeTagSlug?: string
}

export function PostList({
  posts,
  title,
  description,
  emptyMessage = 'No posts match the current filters.',
  activeTagSlug
}: PostListProps) {
  return (
    <section className="blog-list-section">
      {title || description ? (
        <header className="blog-list-header">
          {title ? <h2 className="blog-list-title">{title}</h2> : null}
          {description ? <p className="blog-list-description">{description}</p> : null}
        </header>
      ) : null}

      {posts.length === 0 ? (
        <div className="blog-empty-state">
          <p>{emptyMessage}</p>
        </div>
      ) : (
        <div className="blog-post-grid">
          {posts.map((post) => (
            <PostCard key={post.slug} post={post} activeTagSlug={activeTagSlug} />
          ))}
        </div>
      )}
    </section>
  )
}
