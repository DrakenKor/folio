import path from 'node:path'
import matter from 'gray-matter'
import { BLOG_DATE_PATTERN, slugifyTag } from './blog-helpers'
import type {
  BlogDataSnapshot,
  BlogFrontmatter,
  BlogPost,
  BlogPostMeta,
  BlogTag,
  RawBlogSource
} from '../types/blog'

/** Raw contents of a src/content/stubs/<slug>.json file, before parsing. */
export interface RawBlogStubSource {
  fileName: string
  source: string
}

const BLOG_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

interface NormalizedDateParts {
  year: number
  month: number
  day: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function assertNonEmptyString(
  value: unknown,
  field: keyof BlogFrontmatter,
  fileName: string
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid blog frontmatter in "${fileName}": "${field}" is required.`)
  }

  return value.trim()
}

function parseDateParts(date: string, fileName = 'blog post'): NormalizedDateParts {
  if (!BLOG_DATE_PATTERN.test(date)) {
    throw new Error(
      `Invalid blog frontmatter in "${fileName}": "date" must use YYYY-MM-DD.`
    )
  }

  const [year, month, day] = date.split('-').map(Number)
  const normalizedDate = new Date(Date.UTC(year, month - 1, day))

  if (
    normalizedDate.getUTCFullYear() !== year ||
    normalizedDate.getUTCMonth() !== month - 1 ||
    normalizedDate.getUTCDate() !== day
  ) {
    throw new Error(
      `Invalid blog frontmatter in "${fileName}": "date" is not a real calendar date.`
    )
  }

  return { year, month, day }
}

function ensureValidSlug(slug: string, fileName: string): string {
  if (!BLOG_SLUG_PATTERN.test(slug)) {
    throw new Error(
      `Invalid blog filename "${fileName}": filenames must be kebab-case ASCII and unique.`
    )
  }

  return slug
}

function normalizeTags(tags: unknown, fileName: string) {
  if (!Array.isArray(tags) || tags.length === 0) {
    throw new Error(`Invalid blog frontmatter in "${fileName}": "tags" is required.`)
  }

  const normalizedLabels: string[] = []
  const normalizedSlugs: string[] = []
  const seenTagSlugs = new Set<string>()

  for (const rawTag of tags) {
    if (typeof rawTag !== 'string') {
      throw new Error(
        `Invalid blog frontmatter in "${fileName}": every tag must be a string.`
      )
    }

    const label = rawTag.trim()

    if (!label) {
      throw new Error(
        `Invalid blog frontmatter in "${fileName}": tags cannot be empty strings.`
      )
    }

    const slug = slugifyTag(label)

    if (!slug) {
      throw new Error(
        `Invalid blog frontmatter in "${fileName}": "${label}" does not produce a valid tag slug.`
      )
    }

    if (seenTagSlugs.has(slug)) {
      continue
    }

    seenTagSlugs.add(slug)
    normalizedLabels.push(label)
    normalizedSlugs.push(slug)
  }

  return {
    tags: normalizedLabels,
    tagSlugs: normalizedSlugs
  }
}

function normalizeFrontmatter(
  fileName: string,
  frontmatter: unknown
): Omit<BlogPostMeta, 'slug'> {
  if (!isRecord(frontmatter)) {
    throw new Error(`Invalid blog frontmatter in "${fileName}": frontmatter must be an object.`)
  }

  const title = assertNonEmptyString(frontmatter.title, 'title', fileName)
  const description = assertNonEmptyString(
    frontmatter.description,
    'description',
    fileName
  )
  const date = assertNonEmptyString(frontmatter.date, 'date', fileName)

  parseDateParts(date, fileName)

  const normalizedTags = normalizeTags(frontmatter.tags, fileName)
  const sealed = frontmatter.sealed === true

  return {
    title,
    description,
    date,
    tags: normalizedTags.tags,
    tagSlugs: normalizedTags.tagSlugs,
    sealed
  }
}

function sortPostsDescending(posts: BlogPost[]) {
  posts.sort((left, right) => {
    if (left.date === right.date) {
      return left.slug.localeCompare(right.slug)
    }

    return right.date.localeCompare(left.date)
  })
}

function buildTagIndex(posts: BlogPostMeta[]): BlogTag[] {
  const tagMap = new Map<string, BlogTag>()

  for (const post of posts) {
    post.tagSlugs.forEach((tagSlug, index) => {
      const existingTag = tagMap.get(tagSlug)
      const label = post.tags[index]

      if (existingTag) {
        existingTag.count += 1
        return
      }

      tagMap.set(tagSlug, {
        label,
        slug: tagSlug,
        count: 1
      })
    })
  }

  return [...tagMap.values()].sort((left, right) => {
    if (left.count === right.count) {
      return left.label.localeCompare(right.label)
    }

    return right.count - left.count
  })
}

function getSlugFromFileName(fileName: string): string {
  return ensureValidSlug(path.basename(fileName, path.extname(fileName)), fileName)
}

/**
 * Sorts, derives postMeta and builds the tag index for an already-assembled
 * post list. Shared by the MDX loader and by blog.ts, which merges in sealed
 * stub posts before calling this — so tag counts, tag pages and adjacency all
 * see the full set.
 */
export function createBlogDataFromPosts(posts: BlogPost[]): BlogDataSnapshot {
  const sortedPosts = [...posts]
  sortPostsDescending(sortedPosts)

  const postMeta = sortedPosts.map(({ content, ...meta }) => meta)

  return {
    posts: sortedPosts,
    postMeta,
    tags: buildTagIndex(postMeta)
  }
}

function parseMdxPosts(rawSources: RawBlogSource[]): BlogPost[] {
  const seenSlugs = new Set<string>()

  return rawSources.map(({ fileName, source }) => {
    if (!fileName.endsWith('.mdx')) {
      throw new Error(`Unsupported blog source "${fileName}": only .mdx files are allowed.`)
    }

    const slug = getSlugFromFileName(fileName)

    if (seenSlugs.has(slug)) {
      throw new Error(`Duplicate blog slug "${slug}" detected.`)
    }

    seenSlugs.add(slug)

    const { data, content } = matter(source)
    const normalizedFrontmatter = normalizeFrontmatter(fileName, data)

    return {
      slug,
      // Defence in depth: a sealed post's body must never render, even if a
      // plaintext body somehow slipped into the source file.
      content: normalizedFrontmatter.sealed ? '' : content.trim(),
      ...normalizedFrontmatter
    }
  })
}

export function createBlogDataFromSources(rawSources: RawBlogSource[]): BlogDataSnapshot {
  return createBlogDataFromPosts(parseMdxPosts(rawSources))
}

/**
 * Parses a stub file (public metadata for a sealed post) into a BlogPost with
 * an empty body. Reuses the same field validators and the same slug check as
 * the MDX path, so a malformed stub fails the same way a malformed post would.
 */
export function createSealedPostFromStubSource({ fileName, source }: RawBlogStubSource): BlogPost {
  const slug = getSlugFromFileName(fileName)

  let parsed: unknown

  try {
    parsed = JSON.parse(source)
  } catch {
    throw new Error(`Invalid blog stub in "${fileName}": not valid JSON.`)
  }

  if (!isRecord(parsed)) {
    throw new Error(`Invalid blog stub in "${fileName}": stub must be an object.`)
  }

  const title = assertNonEmptyString(parsed.title, 'title', fileName)
  const description = assertNonEmptyString(parsed.description, 'description', fileName)
  const date = assertNonEmptyString(parsed.date, 'date', fileName)

  parseDateParts(date, fileName)

  const normalizedTags = normalizeTags(parsed.tags, fileName)

  return {
    slug,
    title,
    description,
    date,
    tags: normalizedTags.tags,
    tagSlugs: normalizedTags.tagSlugs,
    sealed: true,
    content: ''
  }
}

/**
 * Merges MDX-authored posts with sealed stub posts before sorting and
 * building the tag index, so tag counts, tag pages and adjacency all include
 * sealed posts naturally.
 */
export function createBlogDataFromSourcesAndStubs(
  rawSources: RawBlogSource[],
  rawStubSources: RawBlogStubSource[]
): BlogDataSnapshot {
  const mdxPosts = parseMdxPosts(rawSources)
  const sealedPosts = rawStubSources.map(createSealedPostFromStubSource)

  const seenSlugs = new Set<string>()

  for (const post of [...mdxPosts, ...sealedPosts]) {
    if (seenSlugs.has(post.slug)) {
      throw new Error(`Duplicate blog slug "${post.slug}" detected.`)
    }

    seenSlugs.add(post.slug)
  }

  return createBlogDataFromPosts([...mdxPosts, ...sealedPosts])
}
