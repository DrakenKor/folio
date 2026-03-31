/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { BlogIndexClient } from '../components/blog/BlogIndexClient'
import type { BlogPostMeta, BlogTag } from '../types/blog'

const posts: BlogPostMeta[] = [
  {
    slug: 'dynamic-work',
    title: 'Writing for dynamic work.',
    description: 'My writing.',
    date: '2026-03-01',
    tags: ['Writing'],
    tagSlugs: ['writing']
  }
]

const tags: BlogTag[] = [
  {
    label: 'Writing',
    slug: 'writing',
    count: 1
  }
]

describe('BlogIndexClient', () => {
  it('keeps the filter panel closed by default and opens it from the mobile toggle', () => {
    const { container } = render(<BlogIndexClient posts={posts} tags={tags} />)

    const toggleButton = screen.getByRole('button', { name: /search.*filters/i })
    const filterPanel = container.querySelector('.blog-filter-panel')

    expect(toggleButton).toHaveAttribute('aria-expanded', 'false')
    expect(filterPanel).not.toHaveClass('is-mobile-open')
    expect(screen.getByText('Showing 1 of 1 posts')).toBeInTheDocument()

    fireEvent.click(toggleButton)

    expect(toggleButton).toHaveAttribute('aria-expanded', 'true')
    expect(filterPanel).toHaveClass('is-mobile-open')
  })
})
