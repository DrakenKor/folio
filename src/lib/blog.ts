import 'server-only'

import fs from 'node:fs'
import path from 'node:path'
import { createBlogDataFromSources } from '@/lib/blog-core'
import { formatBlogMonthValue, getBlogMonthValue } from '@/lib/blog-helpers'
import type { BlogDataSnapshot, BlogPost, BlogPostMeta, BlogTag } from '@/types/blog'

const DEFAULT_BLOG_CONTENT_DIR = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  'src',
  'content',
  'blog'
)

const blogCache = new Map<string, BlogDataSnapshot>()

function resolveBlogContentDirectory(contentDirectory?: string) {
  return path.resolve(contentDirectory ?? DEFAULT_BLOG_CONTENT_DIR)
}

function loadBlogData(contentDirectory?: string): BlogDataSnapshot {
  const resolvedDirectory = resolveBlogContentDirectory(contentDirectory)
  const cached = blogCache.get(resolvedDirectory)

  if (cached) {
    return cached
  }

  let fileNames: string[]

  try {
    fileNames = fs
      .readdirSync(resolvedDirectory)
      .filter((fileName) => fileName.endsWith('.mdx'))
      .sort((left, right) => left.localeCompare(right))
  } catch (error) {
    throw new Error(
      `Unable to read blog content directory "${resolvedDirectory}": ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }

  const sources = fileNames.map((fileName) => {
    const absoluteFilePath = path.join(resolvedDirectory, fileName)

    try {
      return {
        fileName,
        source: fs.readFileSync(absoluteFilePath, 'utf8')
      }
    } catch (error) {
      throw new Error(
        `Unable to read blog post "${absoluteFilePath}": ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  })

  const blogData = createBlogDataFromSources(sources)
  blogCache.set(resolvedDirectory, blogData)

  return blogData
}

export function clearBlogCache() {
  blogCache.clear()
}

export function getAllPostMeta(contentDirectory?: string): BlogPostMeta[] {
  return loadBlogData(contentDirectory).postMeta
}

export function getPostBySlug(
  slug: string,
  contentDirectory?: string
): BlogPost | undefined {
  return loadBlogData(contentDirectory).posts.find((post) => post.slug === slug)
}

export function getAllTags(contentDirectory?: string): BlogTag[] {
  return loadBlogData(contentDirectory).tags
}

export function getTagBySlug(
  tagSlug: string,
  contentDirectory?: string
): BlogTag | undefined {
  return getAllTags(contentDirectory).find((tag) => tag.slug === tagSlug)
}

export function getPostsByTagSlug(
  tagSlug: string,
  contentDirectory?: string
): BlogPostMeta[] {
  return getAllPostMeta(contentDirectory).filter((post) =>
    post.tagSlugs.includes(tagSlug)
  )
}

export function getAdjacentPosts(
  slug: string,
  contentDirectory?: string
): {
  previous?: BlogPostMeta
  next?: BlogPostMeta
} {
  const posts = getAllPostMeta(contentDirectory)
  const currentIndex = posts.findIndex((post) => post.slug === slug)

  if (currentIndex === -1) {
    return {}
  }

  return {
    previous: posts[currentIndex - 1],
    next: posts[currentIndex + 1]
  }
}

export function formatBlogMonth(date: string, locale = 'en-US'): string {
  return formatBlogMonthValue(getBlogMonthValue(date), locale)
}
