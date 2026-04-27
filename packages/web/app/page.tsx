import { WorldViewer } from '../components/world-viewer'

export default function Page() {
  const relayUrl = process.env.NEXT_PUBLIC_PASCAL_RELAY_URL ?? 'ws://localhost:1234'
  const room = process.env.NEXT_PUBLIC_PASCAL_ROOM ?? 'pascal-world'
  return <WorldViewer relayUrl={relayUrl} room={room} />
}
