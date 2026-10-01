import { CareerTimeline } from '@/components/demo/timeline/CareerTimeline'
import { demoMetadata } from '@/lib/demos'

export const metadata = demoMetadata('timeline')

export default function TimelinePage() {
  return <CareerTimeline />
}
