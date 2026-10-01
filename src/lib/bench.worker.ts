import { createBenchHost } from './bench-workloads'
import type { HostMessage } from './bench-workloads'

const scope = self as unknown as {
  postMessage(message: unknown, transfer?: Transferable[]): void
  onmessage: ((event: MessageEvent<HostMessage>) => void) | null
}

// loadWasm() starts here, once; a failure is remembered and JavaScript-only runs still work.
const host = createBenchHost((message, transfer) => scope.postMessage(message, transfer))

scope.onmessage = event => void host.handle(event.data)
