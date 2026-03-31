export interface BlogFrontmatter {
  title: string
  description: string
  date: string
  tags: string[]
}

export interface BlogPostMeta extends BlogFrontmatter {
  slug: string
  tagSlugs: string[]
}

export interface BlogPost extends BlogPostMeta {
  content: string
}

export interface BlogTag {
  label: string
  slug: string
  count: number
}

export interface BlogDataSnapshot {
  posts: BlogPost[]
  postMeta: BlogPostMeta[]
  tags: BlogTag[]
}

export interface RawBlogSource {
  fileName: string
  source: string
}
