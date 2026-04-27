// Add a swimming pool to the live shared world. Pool = 4 low coping walls +
// a water slab (rendered blue/translucent on the website).
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
const rid = (p) => `${p}_${Math.random().toString(36).slice(2, 18)}`

let levelId = null
for (const n of nodes.values()) {
  if (n.type === 'level') {
    levelId = n.id
    break
  }
}
if (!levelId) {
  console.error('No level found.')
  process.exit(1)
}
console.log(`adding pool to level ${levelId}`)

doc.transact(() => {
  // Pool placement: south of the house. House occupies z = -3..3, so pool
  // sits centred at z = -8. Footprint 5 m × 3 m.
  const cx = 0
  const cz = -8
  const halfW = 2.5     // 5 m wide
  const halfD = 1.5     // 3 m deep
  const copingHeight = 0.4
  const copingThickness = 0.3

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
    thickness: copingThickness,
    height: copingHeight,
    frontSide: 'unknown',
    backSide: 'unknown',
  })
  const south = wallProps('Pool South Edge', [cx - halfW, cz - halfD], [cx + halfW, cz - halfD])
  const north = wallProps('Pool North Edge', [cx - halfW, cz + halfD], [cx + halfW, cz + halfD])
  const west = wallProps('Pool West Edge', [cx - halfW, cz - halfD], [cx - halfW, cz + halfD])
  const east = wallProps('Pool East Edge', [cx + halfW, cz - halfD], [cx + halfW, cz + halfD])
  for (const w of [south, north, west, east]) nodes.set(w.id, w)

  // Water surface — slab marked as 'water' so the renderer tints it blue.
  const waterId = rid('slab')
  nodes.set(waterId, {
    object: 'node',
    id: waterId,
    type: 'slab',
    name: 'Pool Water',
    parentId: levelId,
    visible: true,
    metadata: {},
    position: [cx, copingHeight - 0.05, cz], // sit just below the coping top
    width: halfW * 2 - copingThickness, // inset inside the walls
    depth: halfD * 2 - copingThickness,
    thickness: 0.05,
    materialPreset: 'water',
  })

  // Pool floor — concrete-coloured slab below the water.
  const floorId = rid('slab')
  nodes.set(floorId, {
    object: 'node',
    id: floorId,
    type: 'slab',
    name: 'Pool Floor',
    parentId: levelId,
    visible: true,
    metadata: {},
    position: [cx, -0.05, cz],
    width: halfW * 2 - copingThickness,
    depth: halfD * 2 - copingThickness,
    thickness: 0.1,
  })

  // Hook into level.children so the structural sidebar tracks them.
  const level = nodes.get(levelId)
  if (level && Array.isArray(level.children)) {
    nodes.set(levelId, {
      ...level,
      children: [
        ...level.children,
        south.id,
        north.id,
        west.id,
        east.id,
        waterId,
        floorId,
      ],
    })
  }
})

console.log('pool added.')
await new Promise((r) => setTimeout(r, 1500))
provider.destroy()
process.exit(0)
