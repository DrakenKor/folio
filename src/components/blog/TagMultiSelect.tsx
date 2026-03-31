'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { BlogTag } from '@/types/blog'

interface TagMultiSelectProps {
  options: BlogTag[]
  value: string[]
  onChange: (nextValue: string[]) => void
}

function normalizeValue(value: string) {
  return value.trim().toLowerCase()
}

export function TagMultiSelect({
  options,
  value,
  onChange
}: TagMultiSelectProps) {
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')

  const optionsBySlug = new Map(options.map((option) => [option.slug, option]))
  const selectedOptions = value
    .map((slug) => optionsBySlug.get(slug))
    .filter((option): option is BlogTag => Boolean(option))
  const selectedTagSummary =
    selectedOptions.length === 0
      ? 'All tags'
      : selectedOptions.map((option) => option.label).join(', ')

  const normalizedSearchValue = normalizeValue(searchValue)
  const filteredOptions = options.filter((option) =>
    normalizedSearchValue.length === 0
      ? true
      : option.label.toLowerCase().includes(normalizedSearchValue)
  )

  useEffect(() => {
    if (!isOpen) {
      setSearchValue('')
      return
    }

    searchInputRef.current?.focus()

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  function toggleOption(slug: string) {
    if (value.includes(slug)) {
      onChange(value.filter((currentValue) => currentValue !== slug))
      return
    }

    onChange([...value, slug])
  }

  function removeOption(slug: string) {
    onChange(value.filter((currentValue) => currentValue !== slug))
  }

  function openMenu() {
    if (!isOpen) {
      setIsOpen(true)
      return
    }

    searchInputRef.current?.focus()
  }

  return (
    <label className="blog-filter-field">
      <span>Tags</span>
      <div
        ref={rootRef}
        className={isOpen ? 'blog-tag-multiselect is-open' : 'blog-tag-multiselect'}>
        <div className="blog-tag-multiselect-control">
          <button
            type="button"
            className="blog-tag-multiselect-trigger"
            aria-label={`Tags: ${selectedTagSummary}`}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-controls={menuId}
            onClick={openMenu}
          />
          <div className="blog-tag-multiselect-values">
            {selectedOptions.length === 0 ? (
              <span className="blog-tag-multiselect-placeholder">
                All tags
              </span>
            ) : (
              selectedOptions.map((option) => (
                <span key={option.slug} className="blog-tag-chip">
                  <span>{option.label}</span>
                  <button
                    type="button"
                    className="blog-tag-chip-remove"
                    aria-label={`Remove ${option.label}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      removeOption(option.slug)
                    }}>
                    x
                  </button>
                </span>
              ))
            )}
          </div>

          <div className="blog-tag-multiselect-controls">
            {value.length > 0 ? (
              <button
                type="button"
                className="blog-tag-multiselect-clear"
                onClick={(event) => {
                  event.stopPropagation()
                  onChange([])
                }}>
                Clear
              </button>
            ) : null}

            <button
              type="button"
              className="blog-tag-multiselect-toggle"
              aria-label={isOpen ? 'Close tag options' : 'Open tag options'}
              onClick={(event) => {
                event.stopPropagation()
                setIsOpen((currentValue) => !currentValue)
              }}>
              v
            </button>
          </div>
        </div>

        {isOpen ? (
          <div id={menuId} className="blog-tag-multiselect-menu">
            <input
              ref={searchInputRef}
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search tags"
              className="blog-filter-input"
            />

            <div
              className="blog-tag-multiselect-options"
              role="listbox"
              aria-multiselectable="true">
              {filteredOptions.length === 0 ? (
                <p className="blog-tag-multiselect-empty">No matching tags.</p>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = value.includes(option.slug)

                  return (
                    <button
                      key={option.slug}
                      type="button"
                      className={
                        isSelected
                          ? 'blog-tag-multiselect-option is-selected'
                          : 'blog-tag-multiselect-option'
                      }
                      onClick={() => toggleOption(option.slug)}
                      role="option"
                      aria-selected={isSelected}>
                      <span className="blog-tag-multiselect-check">
                        {isSelected ? '[x]' : '[ ]'}
                      </span>
                      <span className="blog-tag-multiselect-label">
                        {option.label}
                      </span>
                      <span className="blog-tag-multiselect-count">
                        {option.count}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        ) : null}
      </div>
      <span className="blog-filter-hint">Matches all selected tags.</span>
    </label>
  )
}
