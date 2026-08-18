import 'server-only'

import fs from 'node:fs'
import path from 'node:path'
import { createBlogDataFromSourcesAndStubs } from '@/lib/blog-core'
import type { RawBlogStubSource } from '@/lib/blog-core'
import { formatBlogMonthValue, getBlogMonthValue } from '@/lib/blog-helpers'
import type { BlogDataSnapshot, BlogPost, BlogPostMeta, BlogTag } from '@/types/blog'

const DEFAULT_BLOG_CONTENT_DIR = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  'src',
  'content',
  'blog'
)

const DEFAULT_BLOG_STUB_DIR = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  'src',
  'content',
  'stubs'
)

const blogCache = new Map<string, BlogDataSnapshot>()

function resolveBlogContentDirectory(contentDirectory?: string) {
  return path.resolve(contentDirectory ?? DEFAULT_BLOG_CONTENT_DIR)
}

function resolveBlogStubDirectory(stubDirectory?: string) {
  return path.resolve(stubDirectory ?? DEFAULT_BLOG_STUB_DIR)
}

/** Reads src/content/stubs/*.json — public metadata for sealed posts. A missing directory is treated as empty. */
function readBlogStubSources(stubDirectory: string): RawBlogStubSource[] {
  let fileNames: string[]

  try {
    fileNames = fs
      .readdirSync(stubDirectory)
      .filter((fileName) => fileName.endsWith('.json'))
      .sort((left, right) => left.localeCompare(right))
  } catch (error) {
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }

    throw new Error(
      `Unable to read blog stub directory "${stubDirectory}": ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }

  return fileNames.map((fileName) => {
    const absoluteFilePath = path.join(stubDirectory, fileName)

    try {
      return {
        fileName,
        source: fs.readFileSync(absoluteFilePath, 'utf8')
      }
    } catch (error) {
      throw new Error(
        `Unable to read blog stub "${absoluteFilePath}": ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  })
}

function loadBlogData(contentDirectory?: string, stubDirectory?: string): BlogDataSnapshot {
  const resolvedDirectory = resolveBlogContentDirectory(contentDirectory)
  const resolvedStubDirectory = resolveBlogStubDirectory(stubDirectory)
  const cacheKey = `${resolvedDirectory} ${resolvedStubDirectory}`
  const cached = blogCache.get(cacheKey)

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

  const stubSources = readBlogStubSources(resolvedStubDirectory)
  const blogData = createBlogDataFromSourcesAndStubs(sources, stubSources)
  blogCache.set(cacheKey, blogData)

  return blogData
}

export function clearBlogCache() {
  blogCache.clear()
}

export function getAllPostMeta(contentDirectory?: string, stubDirectory?: string): BlogPostMeta[] {
  return loadBlogData(contentDirectory, stubDirectory).postMeta
}

export function getPostBySlug(
  slug: string,
  contentDirectory?: string,
  stubDirectory?: string
): BlogPost | undefined {
  return loadBlogData(contentDirectory, stubDirectory).posts.find((post) => post.slug === slug)
}

export function getAllTags(contentDirectory?: string, stubDirectory?: string): BlogTag[] {
  return loadBlogData(contentDirectory, stubDirectory).tags
}

export function getTagBySlug(
  tagSlug: string,
  contentDirectory?: string,
  stubDirectory?: string
): BlogTag | undefined {
  return getAllTags(contentDirectory, stubDirectory).find((tag) => tag.slug === tagSlug)
}

export function getPostsByTagSlug(
  tagSlug: string,
  contentDirectory?: string,
  stubDirectory?: string
): BlogPostMeta[] {
  return getAllPostMeta(contentDirectory, stubDirectory).filter((post) =>
    post.tagSlugs.includes(tagSlug)
  )
}

export function getAdjacentPosts(
  slug: string,
  contentDirectory?: string,
  stubDirectory?: string
): {
  previous?: BlogPostMeta
  next?: BlogPostMeta
} {
  const posts = getAllPostMeta(contentDirectory, stubDirectory)
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
