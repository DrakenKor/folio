import { ShaderPlayground } from '@/components/demo/shader/ShaderPlayground'
import { demoMetadata } from '@/lib/demos'

export const metadata = demoMetadata('shader')

export default function ShaderDemoPage() {
  return <ShaderPlayground />
}
