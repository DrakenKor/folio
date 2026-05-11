import type { MDXRemoteProps } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'

export const blogMdxOptions = {
  mdxOptions: {
    remarkPlugins: [remarkGfm]
  },
  // Blog posts are repo-authored MDX, so allow JSX expression attributes such as
  // questionCount={4} and inline React style objects to survive compilation.
  blockJS: false
} satisfies NonNullable<MDXRemoteProps['options']>
