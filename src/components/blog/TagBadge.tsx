import Link from 'next/link'

interface TagBadgeProps {
  label: string
  slug: string
  active?: boolean
}

export function TagBadge({ label, slug, active = false }: TagBadgeProps) {
  return (
    <Link
      href={`/blog/tag/${slug}`}
      className={active ? 'blog-tag-badge blog-tag-badge-active' : 'blog-tag-badge'}>
      {label}
    </Link>
  )
}
