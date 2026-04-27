// Seeds a room with a sample house and stays connected so the doc persists in
// the relay. Run alongside the web dev server to see content.
import WebSocket from 'ws'
import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'

const URL = process.env.PASCAL_RELAY_URL ?? 'ws://127.0.0.1:21236'
const ROOM = process.env.PASCAL_ROOM ?? 'pascal-world'

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
  setTimeout(resolve, 4000) // proceed even if no peers
})

const nodes = doc.getMap('nodes')
const meta = doc.getMap('meta')

const rid = (p) => `${p}_${Math.random().toString(36).slice(2, 18)}`

doc.transact(() => {
  nodes.clear()

  const siteId = rid('site')
  const buildingId = rid('building')
  const levelId = rid('level')

  // Walls — 8m × 6m rectangle + interior divider
  const W = 8, D = 6
  const w = W / 2, d = D / 2
  const wallProps = (name, start, end) => ({
    object: 'node',
    id: rid('wall'),
    type: 'wall',
    name,
    parentId: levelId,
    visible: true,
    metadata: {},
    children: [],
    start, end,
    thickness: 0.2,
    height: 2.7,
    frontSide: 'unknown',
    backSide: 'unknown',
  })
  const south = wallProps('South Wall', [-w, -d], [w, -d])
  const north = wallProps('North Wall', [-w,  d], [w,  d])
  const west  = wallProps('West Wall',  [-w, -d], [-w, d])
  const east  = wallProps('East Wall',  [ w, -d], [ w, d])
  const interior = wallProps('Interior', [0, -d], [0, d])
  const walls = [south, north, west, east, interior]

  // Roof
  const roofId = rid('roof')
  const segId = rid('rseg')
  const roof = {
    object: 'node',
    id: roofId,
    type: 'roof',
    name: 'Roof',
    parentId: levelId,
    visible: true,
    metadata: {},
    position: [0, 2.7, 0],
    rotation: 0,
    children: [segId],
  }
  const segment = {
    object: 'node',
    id: segId,
    type: 'roof-segment',
    parentId: roofId,
    visible: true,
    metadata: {},
    position: [0, 0, 0],
    rotation: 0,
    roofType: 'gable',
    width: W + 0.4,
    depth: D + 0.4,
    wallHeight: 0,
    roofHeight: 1.8,
    wallThickness: 0.1,
    deckThickness: 0.1,
    overhang: 0.3,
    shingleThickness: 0.05,
  }

  // Slab so the floor renders too
  const slabId = rid('slab')
  const slab = {
    object: 'node',
    id: slabId,
    type: 'slab',
    name: 'Floor',
    parentId: levelId,
    visible: true,
    metadata: {},
    position: [0, -0.05, 0],
    width: W,
    depth: D,
    thickness: 0.1,
  }

  const level = {
    object: 'node',
    id: levelId,
    type: 'level',
    name: 'Level 0',
    parentId: buildingId,
    visible: true,
    metadata: {},
    level: 0,
    children: [...walls.map((w) => w.id), roofId, slabId],
  }
  const building = {
    object: 'node',
    id: buildingId,
    type: 'building',
    name: 'Building',
    parentId: siteId,
    visible: true,
    metadata: {},
    children: [levelId],
    position: [0, 0, 0],
    rotation: [0, 0, 0],
  }
  const site = {
    object: 'node',
    id: siteId,
    type: 'site',
    name: 'Site',
    parentId: null,
    visible: true,
    metadata: {},
    polygon: { type: 'polygon', points: [[-15, -15], [15, -15], [15, 15], [-15, 15]] },
    children: [building],
  }

  for (const n of [site, building, level, ...walls, roof, segment, slab]) {
    nodes.set(n.id, n)
  }
  meta.set('rootNodeIds', [siteId])
})

console.log(`seeded ${nodes.size} nodes; staying connected. Press Ctrl+C to disconnect.`)

// Heartbeat so the connection stays open in some Node modes
setInterval(() => {}, 1 << 30)
