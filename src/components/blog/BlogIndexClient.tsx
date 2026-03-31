'use client'

import { useEffect, useId, useState } from 'react'
import {
  formatBlogMonthName,
  getBlogMonthNumber,
  getBlogYearValue,
  matchesSelectedBlogTags
} from '@/lib/blog-helpers'
import type { BlogPostMeta, BlogTag } from '@/types/blog'
import { PostList } from './PostList'
import { TagMultiSelect } from './TagMultiSelect'

interface BlogIndexClientProps {
  posts: BlogPostMeta[]
  tags: BlogTag[]
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase()
}

export function BlogIndexClient({ posts, tags }: BlogIndexClientProps) {
  const mobileFilterPanelId = useId()
  const [searchValue, setSearchValue] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedYear, setSelectedYear] = useState('all')
  const [selectedMonth, setSelectedMonth] = useState('all')
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false)
  const [mobileFilterToggleAnimationKey, setMobileFilterToggleAnimationKey] = useState(0)

  const years = [...new Set(posts.map((post) => getBlogYearValue(post.date)))]
  const monthSourcePosts =
    selectedYear === 'all'
      ? posts
      : posts.filter((post) => getBlogYearValue(post.date) === selectedYear)
  const months = [...new Set(monthSourcePosts.map((post) => getBlogMonthNumber(post.date)))]
    .sort((left, right) => Number(left) - Number(right))

  useEffect(() => {
    if (selectedMonth !== 'all' && !months.includes(selectedMonth)) {
      setSelectedMonth('all')
    }
  }, [months, selectedMonth])

  const normalizedQuery = normalizeSearchValue(searchValue)
  const filteredPosts = posts.filter((post) => {
    const matchesTag = matchesSelectedBlogTags(post.tagSlugs, selectedTags)
    const matchesYear =
      selectedYear === 'all' || getBlogYearValue(post.date) === selectedYear
    const matchesMonth =
      selectedMonth === 'all' || getBlogMonthNumber(post.date) === selectedMonth
    const matchesText =
      normalizedQuery.length === 0 ||
      [post.title, post.description, ...post.tags]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)

    return matchesTag && matchesYear && matchesMonth && matchesText
  })

  const hasActiveFilters =
    normalizedQuery.length > 0 ||
    selectedTags.length > 0 ||
    selectedYear !== 'all' ||
    selectedMonth !== 'all'

  function handleMobileFilterToggle() {
    setMobileFilterToggleAnimationKey((currentValue) => currentValue + 1)
    setIsMobileFiltersOpen((currentValue) => !currentValue)
  }

  return (
    <div className="blog-index-stack">
      <div className="blog-filter-stack">
        <div className="blog-filter-toolbar">
          <button
            type="button"
            className={
              isMobileFiltersOpen
                ? 'blog-filter-toggle is-active'
                : 'blog-filter-toggle'
            }
            aria-expanded={isMobileFiltersOpen}
            aria-controls={mobileFilterPanelId}
            onClick={handleMobileFilterToggle}>
            <span className="blog-filter-toggle-copy">
              <span
                key={mobileFilterToggleAnimationKey}
                className={
                  mobileFilterToggleAnimationKey > 0
                    ? 'blog-filter-toggle-icon is-animating'
                    : 'blog-filter-toggle-icon'
                }
                aria-hidden="true">
                <span className="blog-filter-toggle-line blog-filter-toggle-line-top" />
                <span className="blog-filter-toggle-line blog-filter-toggle-line-middle" />
                <span className="blog-filter-toggle-line blog-filter-toggle-line-bottom" />
              </span>
              <span>{isMobileFiltersOpen ? 'Hide filters' : 'Search & filters'}</span>
            </span>
            <span className="blog-filter-toggle-status">
              {isMobileFiltersOpen ? 'Close' : 'Open'}
            </span>
          </button>

          <div className="blog-filter-summary">
            <p>
              Showing {filteredPosts.length} of {posts.length} posts
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={() => {
                  setSearchValue('')
                  setSelectedTags([])
                  setSelectedYear('all')
                  setSelectedMonth('all')
                }}
                className="blog-reset-button">
                Clear filters
              </button>
            ) : null}
          </div>
        </div>

        <section
          id={mobileFilterPanelId}
          className={
            isMobileFiltersOpen
              ? 'blog-filter-panel is-mobile-open'
              : 'blog-filter-panel'
          }>
          <div className="blog-filter-grid">
            <label className="blog-filter-field">
              <span>Search</span>
              <input
                type="search"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search titles"
                className="blog-filter-input"
              />
            </label>

            <TagMultiSelect
              options={tags}
              value={selectedTags}
              onChange={setSelectedTags}
            />

            <label className="blog-filter-field">
              <span>Year</span>
              <select
                value={selectedYear}
                onChange={(event) => setSelectedYear(event.target.value)}
                className="blog-filter-select">
                <option value="all">All years</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>

            <label className="blog-filter-field">
              <span>Month</span>
              <select
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
                className="blog-filter-select">
                <option value="all">All months</option>
                {months.map((month) => (
                  <option key={month} value={month}>
                    {formatBlogMonthName(month)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
      </div>

      <PostList
        posts={filteredPosts}
        title={hasActiveFilters ? 'Filtered posts' : 'All posts'}
        description="Blog"
      />
    </div>
  )
}
