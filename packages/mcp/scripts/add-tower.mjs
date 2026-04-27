// Connect to the live shared world and add a tower next to the existing house.
import WebSocket from 'ws'
import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'

const URL = process.env.PASCAL_RELAY_URL ?? 'wss://pascal-relay-deonmenezes.fly.dev'
const ROOM = process.env.PASCAL_ROOM ?? 'pascal-shared-world'

const doc = new Y.Doc()
const provider = new WebsocketProvider(URL, ROOM, doc, {
  WebSocketPolyfill: WebSocket,
  connect: true,
})
provider.on('status', (e) => console.log('relay:', e.status))

await new Promise((resolve) => {
  const onSync = (synced) => {
    if (synced) {
      provider.off('sync', onSync)
      resolve()
    }
  }
  provider.on('sync', onSync)
  setTimeout(resolve, 5000)
})

const nodes = doc.getMap('nodes')
const meta = doc.getMap('meta')
const rid = (p) => `${p}_${Math.random().toString(36).slice(2, 18)}`

// Find the level we should attach to.
let levelId = null
for (const n of nodes.values()) {
  if (n.type === 'level') {
    levelId = n.id
    break
  }
}
if (!levelId) {
  console.error('No level found in the room. Run seed-room.mjs first.')
  process.exit(1)
}
console.log(`attaching tower to level ${levelId}`)

doc.transact(() => {
  // Tower placement: east of the 8x6m house. House east wall is at x=4;
  // leave a 2m gap, tower centred at x=8 with 3x3 footprint.
  const cx = 8
  const cz = 0
  const half = 1.5      // 3 m square tower
  const towerHeight = 8
  const thickness = 0.3

  const wallProps = (name, start, end) => ({
    object: 'node',
    id: rid('wall'),
    type: 'wall',
    name,
    parentId: levelId,
    visible: true,
    metadata: {},
    children: [],
    start,
    end,
    thickness,
    height: towerHeight,
    frontSide: 'unknown',
    backSide: 'unknown',
  })

  const south = wallProps('Tower South', [cx - half, cz - half], [cx + half, cz - half])
  const north = wallProps('Tower North', [cx - half, cz + half], [cx + half, cz + half])
  const west = wallProps('Tower West', [cx - half, cz - half], [cx - half, cz + half])
  const east = wallProps('Tower East', [cx + half, cz - half], [cx + half, cz + half])
  for (const w of [south, north, west, east]) nodes.set(w.id, w)

  // Pyramid-ish gable roof on top
  const roofId = rid('roof')
  const segId = rid('rseg')
  nodes.set(roofId, {
    object: 'node',
    id: roofId,
    type: 'roof',
    name: 'Tower Roof',
    parentId: levelId,
    visible: true,
    metadata: {},
    position: [cx, towerHeight, cz],
    rotation: 0,
    children: [segId],
  })
  nodes.set(segId, {
    object: 'node',
    id: segId,
    type: 'roof-segment',
    parentId: roofId,
    visible: true,
    metadata: {},
    position: [0, 0, 0],
    rotation: 0,
    roofType: 'gable',
    width: half * 2 + 0.4,
    depth: half * 2 + 0.4,
    wallHeight: 0,
    roofHeight: 2.5,
    wallThickness: 0.1,
    deckThickness: 0.1,
    overhang: 0.2,
    shingleThickness: 0.05,
  })

  // Floor slab for the tower
  const slabId = rid('slab')
  nodes.set(slabId, {
    object: 'node',
    id: slabId,
    type: 'slab',
    name: 'Tower Floor',
    parentId: levelId,
    visible: true,
    metadata: {},
    position: [cx, -0.05, cz],
    width: half * 2,
    depth: half * 2,
    thickness: 0.1,
  })

  // Append to level.children so the structural sidebar tracks it
  const level = nodes.get(levelId)
  if (level && Array.isArray(level.children)) {
    nodes.set(levelId, {
      ...level,
      children: [
        ...level.children,
        south.id, north.id, west.id, east.id,
        roofId, slabId,
      ],
    })
  }
})

console.log('tower added.')
// Stay connected briefly so the update propagates.
await new Promise((r) => setTimeout(r, 1500))
provider.destroy()
process.exit(0)
