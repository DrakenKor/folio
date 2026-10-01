import { WasmBenchmark } from '@/components/demo/bench/WasmBenchmark'
import { demoMetadata } from '@/lib/demos'

export const metadata = demoMetadata('wasm')

export default function WasmDemoPage() {
  return <WasmBenchmark />
}
