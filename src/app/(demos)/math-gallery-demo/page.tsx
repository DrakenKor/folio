import { Suspense } from 'react'
import { MathGallery } from '@/components/demo/math/MathGallery'
import { demoMetadata } from '@/lib/demos'

export const metadata = demoMetadata('math')

// The gallery reads ?exhibit= from the URL, which a static page only knows in
// the browser, so it renders inside a Suspense boundary
export default function MathGalleryPage() {
  return (
    <Suspense>
      <MathGallery />
    </Suspense>
  )
}
