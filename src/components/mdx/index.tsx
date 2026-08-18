import { JapanBudgetExplorer } from './JapanBudgetExplorer'
import { KyotoBlossomExplorer } from './KyotoBlossomExplorer'
import { mdxClientComponents } from './mdx-client-components'

export { Callout, Demo, HeroImage, Video, mdxClientComponents } from './mdx-client-components'

// The full component map, for the server-rendered path only (src/app/blog/[slug]/page.tsx).
// JapanBudgetExplorer and KyotoBlossomExplorer read local data files via node:fs, so they
// must never be reachable from a client bundle — see mdx-client-components.tsx.
export const mdxComponents = {
  ...mdxClientComponents,
  KyotoBlossomExplorer,
  JapanBudgetExplorer
}
