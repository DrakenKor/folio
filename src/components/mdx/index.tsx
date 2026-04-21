import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import React from 'react'
import Link from 'next/link'
import { slugifyHeading } from '@/lib/blog-helpers'
import { Demo } from './Demo'
import { KyotoBlossomExplorer } from './KyotoBlossomExplorer'

interface CalloutProps {
  type?: 'info' | 'warning'
  title?: string
  children: ReactNode
}

interface VideoProps {
  title?: string
  src?: string
  youtubeId?: string
  poster?: string
}

interface HeroImageProps extends ComponentPropsWithoutRef<'img'> {
  caption?: ReactNode
}

function joinClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ')
}

function extractTextContent(children: ReactNode): string {
  return React.Children.toArray(children)
    .map((child) => {
      if (typeof child === 'string' || typeof child === 'number') {
        return String(child)
      }

      if (React.isValidElement<{ children?: ReactNode }>(child)) {
        return extractTextContent(child.props.children)
      }

      return ''
    })
    .join(' ')
    .trim()
}

function createHeading(level: 'h1' | 'h2' | 'h3') {
  const sizeClassName = {
    h1: 'text-4xl sm:text-5xl',
    h2: 'text-2xl sm:text-3xl',
    h3: 'text-xl sm:text-2xl'
  }[level]

  return function Heading({
    children,
    className,
    id,
    ...props
  }: ComponentPropsWithoutRef<'h1'>) {
    const Tag = level
    const headingId = id ?? slugifyHeading(extractTextContent(children))

    return (
      <Tag
        id={headingId}
        className={joinClassNames('blog-heading', sizeClassName, className)}
        {...props}>
        <a href={`#${headingId}`} className="blog-heading-link">
          {children}
        </a>
      </Tag>
    )
  }
}

function MdxLink({
  href = '',
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<'a'>) {
  const sharedClassName = joinClassNames('blog-inline-link', className)
  const isInternalLink = href.startsWith('/') || href.startsWith('#')

  if (isInternalLink) {
    return (
      <Link href={href} className={sharedClassName} {...props}>
        {children}
      </Link>
    )
  }

  return (
    <a
      href={href}
      className={sharedClassName}
      target="_blank"
      rel="noreferrer"
      {...props}>
      {children}
    </a>
  )
}

export function Callout({ type = 'info', title, children }: CalloutProps) {
  return (
    <aside className={`blog-callout blog-callout-${type}`}>
      {title ? <p className="blog-callout-title">{title}</p> : null}
      <div>{children}</div>
    </aside>
  )
}

export function Video({ title, src, youtubeId, poster }: VideoProps) {
  if (youtubeId) {
    return (
      <figure className="blog-video">
        <div className="blog-video-frame">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
            title={title ?? 'Embedded video'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
        {title ? <figcaption>{title}</figcaption> : null}
      </figure>
    )
  }

  if (!src) {
    return null
  }

  return (
    <figure className="blog-video">
      <div className="blog-video-frame">
        <video controls playsInline poster={poster}>
          <source src={src} />
        </video>
      </div>
      {title ? <figcaption>{title}</figcaption> : null}
    </figure>
  )
}

export function HeroImage({
  alt = '',
  caption,
  className,
  loading = 'eager',
  ...props
}: HeroImageProps) {
  return (
    <figure className="blog-post-hero">
      <div className="blog-post-hero-frame">
        <img
          alt={alt}
          className={joinClassNames('blog-post-hero-image', className)}
          decoding="async"
          loading={loading}
          {...props}
        />
      </div>
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  )
}

export const mdxComponents = {
  h1: createHeading('h1'),
  h2: createHeading('h2'),
  h3: createHeading('h3'),
  a: MdxLink,
  p: ({ className, ...props }: ComponentPropsWithoutRef<'p'>) => (
    <p className={joinClassNames('blog-copy', className)} {...props} />
  ),
  ul: ({ className, ...props }: ComponentPropsWithoutRef<'ul'>) => (
    <ul className={joinClassNames('blog-list blog-list-unordered', className)} {...props} />
  ),
  ol: ({ className, ...props }: ComponentPropsWithoutRef<'ol'>) => (
    <ol className={joinClassNames('blog-list blog-list-ordered', className)} {...props} />
  ),
  pre: ({ className, ...props }: ComponentPropsWithoutRef<'pre'>) => (
    <pre className={joinClassNames('blog-code-block', className)} {...props} />
  ),
  code: ({ className, ...props }: ComponentPropsWithoutRef<'code'>) => {
    const isCodeBlock = Boolean(className?.includes('language-'))

    return (
      <code
        className={joinClassNames(
          isCodeBlock ? 'blog-code-block-inner' : 'blog-inline-code',
          className
        )}
        {...props}
      />
    )
  },
  blockquote: ({
    className,
    ...props
  }: ComponentPropsWithoutRef<'blockquote'>) => (
    <blockquote className={joinClassNames('blog-blockquote', className)} {...props} />
  ),
  hr: ({ className, ...props }: ComponentPropsWithoutRef<'hr'>) => (
    <hr className={joinClassNames('blog-rule', className)} {...props} />
  ),
  img: ({ className, alt = '', ...props }: ComponentPropsWithoutRef<'img'>) => (
    <img
      alt={alt}
      loading="lazy"
      className={joinClassNames('blog-image', className)}
      {...props}
    />
  ),
  table: ({ className, ...props }: ComponentPropsWithoutRef<'table'>) => (
    <div className="blog-table-wrap">
      <table className={joinClassNames('blog-table', className)} {...props} />
    </div>
  ),
  th: ({ className, ...props }: ComponentPropsWithoutRef<'th'>) => (
    <th className={joinClassNames('blog-table-head', className)} {...props} />
  ),
  td: ({ className, ...props }: ComponentPropsWithoutRef<'td'>) => (
    <td className={joinClassNames('blog-table-cell', className)} {...props} />
  ),
  Callout,
  HeroImage,
  Video,
  Demo,
  KyotoBlossomExplorer
}

export { Demo }
