import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBlogDataFromSources } from '../lib/blog-core'

// blog.ts is a server-only module (fs access + caching). Stubbing the
// server-only guard lets these tests exercise its real directory-reading
// behaviour instead of duplicating it against blog-core alone.
vi.mock('server-only', () => ({}))

const { clearBlogCache, getAllPostMeta, getAllTags, getPostBySlug } = await import(
  '../lib/blog'
)

function writeMdxFixture(blogDir: string) {
  fs.writeFileSync(
    path.join(blogDir, 'open-post.mdx'),
    `---
title: "Open Post"
description: "A public post."
date: "2026-01-01"
tags: ["Family", "Travel"]
---

Open body.
`
  )
}

function writeStubFixture(stubsDir: string) {
  fs.writeFileSync(
    path.join(stubsDir, 'sealed-post.json'),
    JSON.stringify({
      slug: 'sealed-post',
      title: 'Sealed Post',
      description: 'A sealed post.',
      date: '2026-02-01',
      tags: ['Family', 'Secret']
    })
  )
}

describe('sealed posts merge into the blog data set', () => {
  let tmpBase: string
  let blogDir: string
  let stubsDir: string

  beforeEach(() => {
    tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'folio-sealed-test-'))
    blogDir = path.join(tmpBase, 'blog')
    stubsDir = path.join(tmpBase, 'stubs')
    fs.mkdirSync(blogDir)
    fs.mkdirSync(stubsDir)
    writeMdxFixture(blogDir)
    writeStubFixture(stubsDir)
  })

  afterEach(() => {
    clearBlogCache()
    fs.rmSync(tmpBase, { recursive: true, force: true })
  })

  it('merges a stub directory in as a sealed post with correct tag counts', () => {
    const posts = getAllPostMeta(blogDir, stubsDir)
    expect(posts.map((post) => post.slug).sort()).toEqual(['open-post', 'sealed-post'])

    const sealed = posts.find((post) => post.slug === 'sealed-post')
    expect(sealed?.sealed).toBe(true)
    expect(sealed?.tagSlugs).toEqual(['family', 'secret'])
    expect(getPostBySlug('sealed-post', blogDir, stubsDir)?.content).toBe('')

    const tags = getAllTags(blogDir, stubsDir)
    expect(tags.find((tag) => tag.slug === 'family')?.count).toBe(2)
  })

  it('handles a missing stubs directory without throwing', () => {
    const missingStubsDir = path.join(tmpBase, 'no-such-stubs')

    expect(() => getAllPostMeta(blogDir, missingStubsDir)).not.toThrow()
    expect(getAllPostMeta(blogDir, missingStubsDir).map((post) => post.slug)).toEqual([
      'open-post'
    ])
  })
})

describe('sealed post bodies are dropped by blog-core', () => {
  it('forces content to an empty string when frontmatter marks a post sealed', () => {
    const snapshot = createBlogDataFromSources([
      {
        fileName: 'sealed-post.mdx',
        source: `---
title: "Sealed"
description: "A sealed post."
date: "2026-01-01"
tags: ["Family"]
sealed: true
---

This body must never render.
`
      }
    ])

    expect(snapshot.posts[0].sealed).toBe(true)
    expect(snapshot.posts[0].content).toBe('')
  })
})
