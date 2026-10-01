import Link from 'next/link'
import { ReactNode } from 'react'
import { demos, sourceUrl } from '@/lib/demos'

interface NotesProps {
  children: ReactNode
  // The demo's slug, to offer the next one at the foot of the notes
  slug: string
}

/**
 * Below the stage: what you are looking at, how it works, and the source.
 * Plain text on black in one 68-character column. The notes describe; they
 * do not sell.
 */
export function Notes({ children, slug }: NotesProps) {
  const index = demos.findIndex(demo => demo.slug === slug)
  const next = demos[(index + 1) % demos.length]
  return (
    <section className="demo-notes" id="notes" aria-label="Notes">
      {children}
      <p className="demo-notes-next">
        <span className="demo-key">Next</span> <Link href={next.route} prefetch={false}>
          {next.title}
        </Link>
      </p>
    </section>
  )
}

export function NotesSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="demo-notes-section">
      <h2>{title}</h2>
      {children}
    </div>
  )
}

// Links to files in the public repository, each shown as its path
export function NotesSource({ files }: { files: string[] }) {
  return (
    <NotesSection title="Source">
      <ul className="demo-notes-source">
        {files.map(path => (
          <li key={path}>
            <a href={sourceUrl(path)} target="_blank" rel="noreferrer">
              {path}
            </a>
          </li>
        ))}
      </ul>
    </NotesSection>
  )
}
