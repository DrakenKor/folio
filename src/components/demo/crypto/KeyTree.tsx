export type TreeNode = 'master' | 'hkdfTag' | 'hkdfPost' | 'tagKey' | 'postKey' | 'content' | 'aes' | 'cipher'

interface KeyTreeProps {
  // Nodes whose step has happened
  lit: TreeNode[]
  // Nodes the latest action used
  active: TreeNode[]
  // The ciphertext was changed after sealing
  altered: boolean
}

const WIDTH = 150
const HEIGHT = 30

const NODES: { id: TreeNode; label: string; x: number; y: number }[] = [
  { id: 'master', label: 'master secret', x: 170, y: 8 },
  { id: 'hkdfTag', label: 'HKDF: tag', x: 80, y: 62 },
  { id: 'hkdfPost', label: 'HKDF: post', x: 260, y: 62 },
  { id: 'tagKey', label: 'tag key', x: 80, y: 116 },
  { id: 'postKey', label: 'post key', x: 260, y: 116 },
  { id: 'content', label: 'content key', x: 170, y: 190 },
  { id: 'aes', label: 'AES-GCM', x: 170, y: 244 },
  { id: 'cipher', label: 'ciphertext', x: 170, y: 298 }
]

const EDGES: [TreeNode, TreeNode, string?][] = [
  ['master', 'hkdfTag'],
  ['master', 'hkdfPost'],
  ['hkdfTag', 'tagKey'],
  ['hkdfPost', 'postKey'],
  ['tagKey', 'content', 'wraps'],
  ['postKey', 'content', 'wraps'],
  ['content', 'aes'],
  ['aes', 'cipher']
]

const byId = Object.fromEntries(NODES.map(node => [node.id, node])) as Record<TreeNode, (typeof NODES)[number]>

/** How a post is sealed: one master, two derived keys, one content key. */
export function KeyTree({ lit, active, altered }: KeyTreeProps) {
  return (
    <svg
      className="crypto-tree"
      viewBox="0 0 340 340"
      role="img"
      aria-label="Key tree: the master secret derives a tag key and a post key with HKDF. Both wrap the content key, which encrypts the message with AES-GCM to make the ciphertext.">
      {EDGES.map(([from, to, label]) => {
        const a = byId[from]
        const b = byId[to]
        const x1 = a.x
        const y1 = a.y + HEIGHT
        const y2 = b.y
        return (
          <g key={`${from}-${to}`}>
            <line className="crypto-edge" data-lit={lit.includes(to)} x1={x1} y1={y1} x2={b.x} y2={y2} />
            {label && (
              <text className="crypto-edge-label" x={(x1 + b.x) / 2 + (x1 < b.x ? -8 : 8)} y={(y1 + y2) / 2 + 4} textAnchor={x1 < b.x ? 'end' : 'start'}>
                {label}
              </text>
            )}
          </g>
        )
      })}
      {NODES.map(node => (
        <g key={node.id} className="crypto-node" data-lit={lit.includes(node.id)} data-active={active.includes(node.id)} data-altered={node.id === 'cipher' && altered}>
          <rect x={node.x - WIDTH / 2} y={node.y} width={WIDTH} height={HEIGHT} rx="8" />
          <text x={node.x} y={node.y + HEIGHT / 2 + 4} textAnchor="middle">
            {node.id === 'cipher' && altered ? 'ciphertext (altered)' : node.label}
          </text>
        </g>
      ))}
    </svg>
  )
}
