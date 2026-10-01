import { ImageFilters } from '@/components/demo/image/ImageFilters'
import { demoMetadata } from '@/lib/demos'

export const metadata = demoMetadata('image')

export default function ImageProcessingDemoPage() {
  return <ImageFilters />
}
