# MDX Blog System Implementation Plan

## Goal

Add a static MDX blog to the portfolio site.

The blog should support:

- rich MDX content with curated React components
- browsing by tag
- client-side filtering on the index page by tag, date, and text
- fully static generation for GitHub Pages using the existing `output: 'export'` setup

## Repo Constraints That Affect the Design

- The app already uses the Next.js App Router and `output: 'export'` in `next.config.js`.
- Deployment is handled by `.github/workflows/nextjs.yml`, so every blog route must exist at build time.
- Any filesystem access must stay in server-only code. The webpack config explicitly disables `fs` in client bundles.
- `tsconfig.json` already has `@/*`, so `@/content/...` will work without adding another alias.
- The root layout already defines site-wide metadata. Blog routes should add route-specific metadata on top of that.

## Dependencies

```bash
npm install next-mdx-remote gray-matter
```

Why these are enough:

- `next-mdx-remote/rsc` handles MDX compilation in server components.
- `gray-matter` parses frontmatter.
- `Intl.DateTimeFormat` can format dates without another dependency.

Not needed for the initial version:

- `@next/mdx`
- a syntax-highlighting library
- a date library

This keeps the implementation small and compatible with static export.

## Content Model

### Directory

All posts live in:

```text
src/content/blog/*.mdx
```

### Slug Rules

- Use the filename as the canonical slug.
- Keep filenames kebab-case, ASCII, and unique.
- Do not store a separate `slug` field in frontmatter unless there is a real need for custom URLs.

Example:

```text
src/content/blog/shipping-wasm-to-github-pages.mdx
```

becomes:

```text
/blog/shipping-wasm-to-github-pages
```

### Frontmatter Shape

```ts
export interface BlogFrontmatter {
  title: string
  description: string
  date: string // YYYY-MM-DD
  tags: string[]
}

export interface BlogPostMeta extends BlogFrontmatter {
  slug: string
  tagSlugs: string[]
}

export interface BlogPost extends BlogPostMeta {
  content: string
}

export interface BlogTag {
  label: string
  slug: string
  count: number
}
```

Example post frontmatter:

```mdx
---
title: "Shipping WebAssembly to GitHub Pages"
description: "Notes from building a static-export-friendly WASM demo in Next.js."
date: "2026-03-15"
tags: ["WebAssembly", "Next.js", "Performance"]
---
```

### Validation Rules

Validation should happen during the build, not at runtime.

- `title`, `description`, `date`, and `tags` are required.
- `date` must be `YYYY-MM-DD`.
- Tags should be trimmed, deduplicated, and preserved as human-readable labels.
- Tag URLs should use a slugified version of the label, for example `Next.js` -> `next-js`.
- Sort posts by date descending, then by slug ascending for deterministic output.
- Throw a build error for invalid frontmatter, duplicate slugs, or unreadable files.

### Date Handling

Use `YYYY-MM-DD` in frontmatter and treat it as a date-only value.

Important detail:

- do not rely on local-time parsing if you want stable output across environments
- when formatting, normalize the date consistently so CI and local builds do not shift a post by one day

### Asset Convention

For the initial version, keep blog media in:

```text
public/blog/
```

and reference it from MDX with stable public paths.

Examples:

- `/blog/wasm-pipeline/hero.png`
- `/blog/wasm-pipeline/demo.mp4`

This avoids adding MDX import handling for post-local assets in v1.

## Proposed Files

| Path | Purpose | Notes |
| --- | --- | --- |
| `src/types/blog.ts` | Blog types | Frontmatter, post meta, full post, tag metadata |
| `src/lib/blog.ts` | Server-only content utilities | Uses `fs`, `path`, and `gray-matter`; add `import 'server-only'` |
| `src/components/mdx/index.tsx` | MDX component map | Shared overrides and curated embedded components |
| `src/components/blog/PostCard.tsx` | Blog list card | Used on index and tag pages |
| `src/components/blog/PostList.tsx` | Shared list renderer | Receives metadata array and heading/context |
| `src/components/blog/TagBadge.tsx` | Tag chip | Links to `/blog/tag/[tag]` using the tag slug |
| `src/components/blog/BlogIndexClient.tsx` | Client filter island | Holds `useState` for search and filter controls |
| `src/app/blog/layout.tsx` | Blog route layout | Imports `blog.css` and provides shared shell |
| `src/app/blog/page.tsx` | Blog index page | Server component that passes metadata into `BlogIndexClient` |
| `src/app/blog/[slug]/page.tsx` | Individual post page | Uses `generateStaticParams`, `dynamicParams = false`, and `generateMetadata` |
| `src/app/blog/tag/[tag]/page.tsx` | Tag archive page | Uses tag slugs, `generateStaticParams`, and `generateMetadata` |
| `src/app/blog/blog.css` | Route-scoped blog styles | Import from `src/app/blog/layout.tsx` |
| `src/content/blog/*.mdx` | Post content | Source-controlled MDX files |

## Server-Only Content Utilities

`src/lib/blog.ts` should stay server-only because it reads the filesystem.

Recommended responsibilities:

- `getAllPostMeta()`
  - read all `src/content/blog/*.mdx` files
  - parse frontmatter
  - validate data
  - return sorted metadata only
- `getPostBySlug(slug)`
  - load one post's MDX content plus metadata
- `getAllTags()`
  - derive `{ label, slug, count }[]` from `getAllPostMeta()`
- `getAdjacentPosts(slug)` or equivalent inline logic
  - support previous/next navigation on post pages

This is preferable to reading and compiling the full MDX body for every post on the blog index.

Implementation notes:

- Use `path.join(process.cwd(), 'src', 'content', 'blog')`.
- Use `import 'server-only'` at the top of the module.
- Keep helper functions for `slugifyTag`, date normalization, and validation close to this module.

## MDX Components

Create a curated component map in `src/components/mdx/index.tsx` and pass it to `<MDXRemote />`.

Recommended overrides:

- `h1`, `h2`, `h3`
  - match the site's visual style
  - add stable anchor IDs for deep links
- `a`
  - style inline links consistently
  - handle external links safely
- `pre`, `code`
  - dark theme code blocks
  - horizontal scrolling for long lines
- `blockquote`, `hr`, `ul`, `ol`, `img`
  - consistent prose styling

Recommended custom components:

- `<Callout type="info" | "warning">`
  - highlighted information blocks
- `<Video />`
  - responsive YouTube or HTML video wrapper
- `<Demo name="..." />`
  - wrapper around pre-registered interactive demo components

Important constraint:

- keep MDX components curated and registered in code
- avoid arbitrary imports from post files in the initial version
- any interactive component exposed to MDX should be implemented as a client component

## UI Components

### `PostCard.tsx`

Display:

- title
- formatted date
- description
- tags

Behavior:

- links to `/blog/[slug]`
- matches the current homepage style with subdued default opacity and stronger hover state

### `PostList.tsx`

Shared list wrapper used by:

- `/blog`
- `/blog/tag/[tag]`

This keeps layout and empty-state behavior consistent.

### `TagBadge.tsx`

- render the human-readable tag label
- link using the slugified tag URL
- keep styles lightweight so the badges feel native to the current homepage

### `BlogIndexClient.tsx`

This is the missing piece the current plan needs.

The index page wants client-side filtering, but the content loader must stay server-only. The clean split is:

- `src/app/blog/page.tsx` stays a server component
- it loads serializable post metadata
- it passes that metadata into `BlogIndexClient.tsx`
- `BlogIndexClient.tsx` handles `useState` for search, tag, and date filters

This avoids importing `fs` code into a client bundle.

## Routes

| Route | File | Static Params | Notes |
| --- | --- | --- | --- |
| `/blog` | `src/app/blog/page.tsx` | None | Server page renders metadata and mounts the filter client component |
| `/blog/[slug]` | `src/app/blog/[slug]/page.tsx` | All post slugs | Render MDX, metadata header, tags, and previous/next navigation |
| `/blog/tag/[tag]` | `src/app/blog/tag/[tag]/page.tsx` | All tag slugs | Render filtered post list for one tag |

Route details that should be explicit in the implementation:

- add `export const dynamicParams = false` on `[slug]` and `[tag]`
- use `generateStaticParams()` for both routes
- call `notFound()` if a slug or tag is missing from the generated dataset
- use `generateMetadata()` for SEO and share previews

## Metadata and SEO

The current root layout already provides site-level defaults. Blog routes should add:

- `/blog`
  - title like `Blog | Manav Dhindsa`
  - description for the overall writing section
- `/blog/[slug]`
  - title from post frontmatter
  - description from post frontmatter
  - canonical path based on the slug
- `/blog/tag/[tag]`
  - tag-specific title and description

Nice to have, but not required for v1:

- Open Graph images per post
- JSON-LD structured data

## Year and Month Filtering

Do not create dedicated year/month archive routes in the initial version.

Instead:

- derive available year/month values from `getAllPostMeta()`
- expose them as filter options on `/blog`
- keep the generated route surface small

This keeps the implementation aligned with static export while avoiding many sparse archive pages.

## Styling

Add route-specific blog styles in:

```text
src/app/blog/blog.css
```

Import that file from:

```text
src/app/blog/layout.tsx
```

Why this matters:

- the styles stay scoped to the blog route segment
- the root layout stays clean
- prose styles do not leak into the demo pages

Recommended styling coverage:

- article width and spacing
- heading rhythm
- paragraph and list spacing
- link appearance
- code blocks and inline code
- blockquotes
- tables, if future posts need them
- responsive video and image sizing

Visual direction:

- keep the current black / gray palette
- use restrained accent color, not a completely new design system
- match the existing understated hover treatment from the homepage

## Sample Content

Add at least two MDX posts in `src/content/blog/` that demonstrate:

- frontmatter with multiple tags
- headings and subheadings
- code blocks
- a `Callout`
- a `Video` embed
- at least one inline link

This is enough to verify the component map and styling end to end.

## Changes to Existing Files

### `src/app/page.tsx`

Add a blog link in the `Interactive Demos` section:

```tsx
<Link
  href="/blog"
  className="opacity-40 hover:opacity-100 fade duration-1000 text-center hover:underline"
>
  <span className="underline">Blog</span>
  &nbsp;
  <span className="text-sm text-gray-400">Technical writing & demos</span>
</Link>
```

### `tsconfig.json`

No change needed for the initial implementation.

The existing `@/*` alias already covers `src/content/blog`.

## Implementation Order

1. Install `next-mdx-remote` and `gray-matter`.
2. Add `src/types/blog.ts`.
3. Add `src/lib/blog.ts` with validation, tag slugging, and date normalization.
4. Add sample posts under `src/content/blog/`.
5. Add `src/components/mdx/index.tsx`.
6. Add `src/components/blog/PostCard.tsx`, `PostList.tsx`, `TagBadge.tsx`, and `BlogIndexClient.tsx`.
7. Add `src/app/blog/layout.tsx` and `src/app/blog/blog.css`.
8. Add `src/app/blog/[slug]/page.tsx`.
9. Add `src/app/blog/tag/[tag]/page.tsx`.
10. Add `src/app/blog/page.tsx`.
11. Update `src/app/page.tsx` to link to `/blog`.

## Verification

### Build and Route Verification

1. Run `npm run build`.
2. Confirm the export contains:
   - `out/blog/index.html`
   - `out/blog/<slug>/index.html`
   - `out/blog/tag/<tag>/index.html`
3. Serve the output locally with `npx serve out`.

### Behavior Verification

1. Verify blog index filtering works without network requests.
2. Verify individual MDX posts render correctly.
3. Verify `Callout`, `Video`, links, images, and code blocks render as expected.
4. Verify previous/next navigation works on post pages.
5. Verify invalid slugs and tags resolve to the static 404 output.

### Recommended Automated Tests

If test coverage is desired, add a small Vitest file for the content utilities and cover:

- frontmatter validation
- date sorting
- tag slug generation
- tag counting
- duplicate slug handling

## Summary

The current plan is directionally correct, but it was missing a few implementation-critical details:

- server-only boundaries for filesystem access
- a dedicated client filtering component for the blog index
- tag slug normalization for route safety
- route-level layout import for blog-specific CSS
- explicit static route behavior for `generateStaticParams`, `dynamicParams = false`, and metadata

With those details added, the plan is consistent with the current repo structure and the GitHub Pages deployment model.
