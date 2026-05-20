import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createBlogDataFromSources } from '../lib/blog-core'
import { matchesSelectedBlogTags } from '../lib/blog-helpers'

function buildPostSource({
  title = 'Example Post',
  description = 'Example description.',
  date = '2026-03-10',
  tags = ['Next.js', 'WebAssembly']
}: {
  title?: string
  description?: string
  date?: string
  tags?: string[]
}) {
  return `---
title: "${title}"
description: "${description}"
date: "${date}"
tags: [${tags.map((tag) => `"${tag}"`).join(', ')}]
---

# ${title}

Body copy.
`
}

describe('blog content utilities', () => {
  it('validates required frontmatter fields', () => {
    expect(() =>
      createBlogDataFromSources([
        {
          fileName: 'missing-title.mdx',
          source: `---
description: "Missing title"
date: "2026-03-10"
tags: ["Next.js"]
---

Body copy.
`
        }
      ])
    ).toThrow(/"title" is required/)
  })

  it('sorts posts by date descending and slug ascending', () => {
    const snapshot = createBlogDataFromSources([
      {
        fileName: 'zeta-post.mdx',
        source: buildPostSource({
          title: 'Zeta',
          date: '2026-03-10'
        })
      },
      {
        fileName: 'alpha-post.mdx',
        source: buildPostSource({
          title: 'Alpha',
          date: '2026-03-10'
        })
      },
      {
        fileName: 'newer-post.mdx',
        source: buildPostSource({
          title: 'Newer',
          date: '2026-03-12'
        })
      }
    ])

    expect(snapshot.postMeta.map((post) => post.slug)).toEqual([
      'newer-post',
      'alpha-post',
      'zeta-post'
    ])
  })

  it('slugifies and deduplicates tag labels per post', () => {
    const snapshot = createBlogDataFromSources([
      {
        fileName: 'tagged-post.mdx',
        source: buildPostSource({
          tags: [' Next.js ', 'Next.js', 'WebAssembly']
        })
      }
    ])

    expect(snapshot.postMeta[0].tags).toEqual(['Next.js', 'WebAssembly'])
    expect(snapshot.postMeta[0].tagSlugs).toEqual(['next-js', 'webassembly'])
  })

  it('counts tags across posts using the slugified tag value', () => {
    const snapshot = createBlogDataFromSources([
      {
        fileName: 'first-post.mdx',
        source: buildPostSource({
          tags: ['Next.js', 'WebAssembly']
        })
      },
      {
        fileName: 'second-post.mdx',
        source: buildPostSource({
          title: 'Second',
          tags: ['Performance', 'Next.js']
        })
      }
    ])

    expect(snapshot.tags).toContainEqual({
      label: 'Next.js',
      slug: 'next-js',
      count: 2
    })
  })

  it('requires every selected tag to match the post', () => {
    expect(matchesSelectedBlogTags(['next-js', 'webassembly'], [])).toBe(true)
    expect(matchesSelectedBlogTags(['next-js', 'webassembly'], ['next-js'])).toBe(true)
    expect(
      matchesSelectedBlogTags(
        ['next-js', 'webassembly'],
        ['next-js', 'webassembly']
      )
    ).toBe(true)
    expect(
      matchesSelectedBlogTags(
        ['next-js'],
        ['next-js', 'webassembly']
      )
    ).toBe(false)
  })

  it('throws for duplicate slugs', () => {
    expect(() =>
      createBlogDataFromSources([
        {
          fileName: 'same-post.mdx',
          source: buildPostSource({
            title: 'One'
          })
        },
        {
          fileName: 'same-post.mdx',
          source: buildPostSource({
            title: 'Two'
          })
        }
      ])
    ).toThrow(/Duplicate blog slug/)
  })

  it('keeps SVG text blocks from being parsed as markdown paragraphs', () => {
    const contentDirectory = path.join(process.cwd(), 'src', 'content', 'blog')
    const unsafeSvgTextBlockPattern =
      /<(text|desc)\b[^>]*>\n(?:[ \t]*\n)*[ \t]+(?![{<])\S[^\n]*/g
    const failures: string[] = []

    for (const fileName of fs
      .readdirSync(contentDirectory)
      .filter((name) => name.endsWith('.mdx'))) {
      const source = fs
        .readFileSync(path.join(contentDirectory, fileName), 'utf8')
        .replace(/```[\s\S]*?```/g, '')

      for (const match of source.matchAll(unsafeSvgTextBlockPattern)) {
        const lineNumber = source.slice(0, match.index).split('\n').length + 1
        failures.push(`${fileName}:${lineNumber}`)
      }
    }

    expect(failures).toEqual([])
  })
})
