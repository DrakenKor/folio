/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { TagMultiSelect } from '../components/blog/TagMultiSelect'

describe('TagMultiSelect', () => {
  it('opens the tag menu from the field trigger button', () => {
    const onChange = vi.fn()

    render(
      <TagMultiSelect
        options={[
          {
            label: 'Next.js',
            slug: 'next-js',
            count: 2
          }
        ]}
        value={[]}
        onChange={onChange}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Tags: All tags' }))

    expect(screen.getByPlaceholderText('Search tags')).toBeInTheDocument()
  })
})
