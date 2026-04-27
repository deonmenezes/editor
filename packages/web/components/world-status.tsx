'use client'

export function WorldStatus({
  connected,
  room,
  peerCount,
}: {
  connected: boolean
  room: string
  peerCount: number
}) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        left: 16,
        padding: '10px 14px',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        fontSize: 12,
        lineHeight: 1.6,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        color: '#e8e8e8',
        pointerEvents: 'none',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Pascal — shared world</div>
      <div>
        relay: <span style={{ color: connected ? '#7be57b' : '#e57b7b' }}>
          {connected ? 'connected' : 'connecting…'}
        </span>
      </div>
      <div>room: {room}</div>
      <div>peers online: {peerCount}</div>
      <div style={{ opacity: 0.5, marginTop: 6 }}>
        Build via Claude with the Pascal MCP plugin.
      </div>
    </div>
  )
}
