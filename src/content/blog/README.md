# Generated directory — do not edit

Every `.mdx` file here is written by `scripts/blog-publish.ts`, copied verbatim from `posts/` in the private `folio-sealed` repository. Edits made here are silently overwritten on the next publish, and files with no counterpart in `folio-sealed` are pruned.

Write posts in `folio-sealed/posts/` instead. Style guidance and the MDX component reference live in `folio-sealed/AUTHORING.md`.

Posts marked `sealed: true` never appear in this directory. Their bodies are encrypted into `public/blog-enc/`, and only their public metadata reaches this repository, as `src/content/stubs/<slug>.json`. A pre-commit hook refuses any commit that stages a sealed post's plaintext here.
