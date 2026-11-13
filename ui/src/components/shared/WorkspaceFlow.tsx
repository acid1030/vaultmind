type Node = { label: string; value: number }
const paths = [
  'M 100 52 C 150 52 135 108 190 108',
  'M 100 164 C 150 164 135 108 190 108',
  'M 310 108 C 365 108 350 52 400 52',
  'M 310 108 C 365 108 350 164 400 164',
]

export default function WorkspaceFlow({ nodes }: { nodes: [Node, Node, Node, Node, Node] }) {
  return (
    <svg className="vm-workspace-flow" viewBox="0 0 500 216" role="img"
      aria-label={nodes.map(node => `${node.label} ${node.value}`).join('，')}>
      {paths.map((path, index) => (
        <g key={path} className={`vm-flow-route vm-flow-route-${index}`}>
          <path d={path} fill="none" className="vm-flow-track" />
          <path d={path} fill="none" pathLength={100} className="vm-flow-signal" />
        </g>
      ))}
      {([[0, 22, 100], [0, 134, 100], [190, 74, 120], [400, 22, 100], [400, 134, 100]] as const).map(([x, y, width], i) => (
        <g key={i} transform={`translate(${x} ${y})`} className={i === 2 ? 'vm-flow-node vm-flow-node-center' : 'vm-flow-node'}>
          <rect x="1" y="1" width={width - 2} height={i === 2 ? 66 : 58} rx="8" />
          <text x={width / 2} y="22" className="vm-flow-label">{nodes[i].label}</text>
          <text x={width / 2} y="45" className="vm-flow-value">{nodes[i].value.toLocaleString()}</text>
        </g>
      ))}
    </svg>
  )
}
