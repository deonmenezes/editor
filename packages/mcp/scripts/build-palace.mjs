// Build a luxurious palace in the live shared world.
// Wipes existing scene and constructs: 24 x 16 m footprint with 4 grand
// rooms (throne hall, banquet hall, library, royal chambers), entrance
// portico with columns, marble central courtyard, gold-trimmed walls,
// velvet/marble flooring per room, and a long gable roof.
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

const WALL_HEIGHT = 4.5
const WALL_THICK = 0.35

doc.transact(() => {
  // ---- WIPE ----
  nodes.clear()

  // ---- HIERARCHY ----
  const siteId = rid('site')
  const buildingId = rid('building')
  const levelId = rid('level')

  const childIds = []
  const all = []

  const wall = (name, start, end, opts = {}) => {
    const id = rid('wall')
    childIds.push(id)
    const w = {
      object: 'node',
      id,
      type: 'wall',
      name,
      parentId: levelId,
      visible: true,
      metadata: {},
      children: [],
      start,
      end,
      thickness: opts.thickness ?? WALL_THICK,
      height: opts.height ?? WALL_HEIGHT,
      frontSide: 'unknown',
      backSide: 'unknown',
      ...(opts.materialPreset ? { materialPreset: opts.materialPreset } : {}),
    }
    all.push(w)
    return w
  }

  const slab = (name, position, width, depth, opts = {}) => {
    const id = rid('slab')
    childIds.push(id)
    const s = {
      object: 'node',
      id,
      type: 'slab',
      name,
      parentId: levelId,
      visible: true,
      metadata: {},
      position,
      width,
      depth,
      thickness: opts.thickness ?? 0.1,
      ...(opts.materialPreset ? { materialPreset: opts.materialPreset } : {}),
    }
    all.push(s)
    return s
  }

  const roof = (name, position, width, depth, height, opts = {}) => {
    const roofId = rid('roof')
    const segId = rid('rseg')
    childIds.push(roofId)
    all.push({
      object: 'node',
      id: roofId,
      type: 'roof',
      name,
      parentId: levelId,
      visible: true,
      metadata: {},
      position,
      rotation: opts.rotation ?? 0,
      children: [segId],
    })
    all.push({
      object: 'node',
      id: segId,
      type: 'roof-segment',
      parentId: roofId,
      visible: true,
      metadata: {},
      position: [0, 0, 0],
      rotation: 0,
      roofType: opts.roofType ?? 'gable',
      width,
      depth,
      wallHeight: 0,
      roofHeight: height,
      wallThickness: 0.1,
      deckThickness: 0.1,
      overhang: 0.4,
      shingleThickness: 0.05,
    })
    return roofId
  }

  // ---- PALACE FOOTPRINT: 24 m × 16 m, centred at origin ----
  const HALF_W = 12   // X half-extent
  const HALF_D = 8    // Z half-extent

  // ----- Outer perimeter (marble exterior) -----
  wall('Front Facade — west', [-HALF_W, -HALF_D], [-2, -HALF_D], { materialPreset: 'marble' })
  wall('Front Facade — east', [2, -HALF_D], [HALF_W, -HALF_D], { materialPreset: 'marble' })
  // 4 m gap in the middle of front for grand entrance
  wall('Back wall',           [-HALF_W,  HALF_D], [HALF_W,  HALF_D], { materialPreset: 'marble' })
  wall('West wall',           [-HALF_W, -HALF_D], [-HALF_W, HALF_D], { materialPreset: 'marble' })
  wall('East wall',           [ HALF_W, -HALF_D], [ HALF_W, HALF_D], { materialPreset: 'marble' })

  // ----- Interior dividers (with door gaps) -----
  // E-W divider at z = 0, splits north (chambers/library) from south (throne/banquet)
  wall('Hall divider — west', [-HALF_W, 0], [-1, 0])
  wall('Hall divider — east', [ 1, 0], [ HALF_W, 0])
  // N-S divider at x = 0, splits west (throne/chambers) from east (banquet/library)
  wall('Cross divider — south', [0, -HALF_D + 1], [0, -1])
  wall('Cross divider — north', [0, 1], [0, HALF_D - 1])

  // ----- FLOORS per room (different luxe materials) -----
  // SW quadrant: Throne Hall — crimson velvet
  slab('Throne Hall floor', [-HALF_W / 2, -0.05, -HALF_D / 2], HALF_W, HALF_D, { materialPreset: 'velvet' })
  // SE quadrant: Banquet Hall — black marble
  slab('Banquet Hall floor', [ HALF_W / 2, -0.05, -HALF_D / 2], HALF_W, HALF_D, { materialPreset: 'black-marble' })
  // NW quadrant: Royal Chambers — silk
  slab('Royal Chambers floor', [-HALF_W / 2, -0.05,  HALF_D / 2], HALF_W, HALF_D, { materialPreset: 'silk' })
  // NE quadrant: Grand Library — wood
  slab('Library floor', [ HALF_W / 2, -0.05,  HALF_D / 2], HALF_W, HALF_D, { materialPreset: 'wood' })

  // ----- ENTRANCE PORTICO with columns (front of palace) -----
  // Portico floor extending south of the front entrance
  slab('Entrance plaza', [0, -0.05, -HALF_D - 3], 12, 6, { materialPreset: 'marble' })
  // Two pairs of columns flanking the entrance — short tall walls = pillars
  const COL_H = 5
  const COL_T = 0.6
  wall('Column — front-west',  [-3, -HALF_D - 1.5], [-3 + COL_T, -HALF_D - 1.5 + COL_T], { thickness: COL_T, height: COL_H, materialPreset: 'marble' })
  wall('Column — front-east',  [ 3 - COL_T, -HALF_D - 1.5], [ 3, -HALF_D - 1.5 + COL_T], { thickness: COL_T, height: COL_H, materialPreset: 'marble' })
  wall('Column — front-west2', [-3, -HALF_D - 4.5], [-3 + COL_T, -HALF_D - 4.5 + COL_T], { thickness: COL_T, height: COL_H, materialPreset: 'marble' })
  wall('Column — front-east2', [ 3 - COL_T, -HALF_D - 4.5], [ 3, -HALF_D - 4.5 + COL_T], { thickness: COL_T, height: COL_H, materialPreset: 'marble' })

  // ----- INTERIOR LUXURY ITEMS (rendered as material-tagged slabs) -----
  // Throne — gold pedestal in back of throne room
  slab('Throne pedestal', [-HALF_W / 2 + 1, 0.2, -HALF_D + 1.5], 2.5, 2.0, { thickness: 0.4, materialPreset: 'gold' })
  slab('Throne seat',     [-HALF_W / 2 + 1, 0.7, -HALF_D + 1.5], 1.5, 1.0, { thickness: 0.6, materialPreset: 'gold' })
  // Long banquet table in SE
  slab('Banquet table',     [ HALF_W / 2, 0.4, -HALF_D / 2], 6, 1.4, { thickness: 0.15, materialPreset: 'wood' })
  // Chairs around table (small slabs)
  for (let i = -2; i <= 2; i++) {
    slab(`Chair south ${i}`, [ HALF_W / 2 + i * 1.2, 0.25, -HALF_D / 2 - 1.0], 0.6, 0.6, { thickness: 0.05, materialPreset: 'crimson' })
    slab(`Chair north ${i}`, [ HALF_W / 2 + i * 1.2, 0.25, -HALF_D / 2 + 1.0], 0.6, 0.6, { thickness: 0.05, materialPreset: 'crimson' })
  }
  // Royal bed in NW chambers
  slab('Royal bed frame', [-HALF_W / 2,        0.25,  HALF_D / 2 - 0.5], 3, 2, { thickness: 0.4, materialPreset: 'wood' })
  slab('Royal bedding',   [-HALF_W / 2,        0.55,  HALF_D / 2 - 0.5], 2.6, 1.7, { thickness: 0.15, materialPreset: 'crimson' })
  slab('Royal pillows',   [-HALF_W / 2 - 1.0,  0.7 ,  HALF_D / 2 - 0.5], 0.6, 1.2, { thickness: 0.1, materialPreset: 'silk' })
  // Library shelves (long, tall slabs against walls)
  slab('Bookshelf north',  [ HALF_W / 2,        1.4,  HALF_D - 0.4], 6, 0.4, { thickness: 2.6, materialPreset: 'wood' })
  slab('Bookshelf east',   [ HALF_W - 0.4,      1.4,  HALF_D / 2  ], 0.4, 6, { thickness: 2.6, materialPreset: 'wood' })
  // Reading table in library
  slab('Reading table',    [ HALF_W / 2,        0.4,  HALF_D / 2  ], 2.4, 1.0, { thickness: 0.15, materialPreset: 'wood' })

  // ----- Central rugs (luxury accents) -----
  slab('Throne rug', [-HALF_W / 2, 0.05, -HALF_D / 2], 4, 6, { thickness: 0.02, materialPreset: 'crimson' })
  slab('Banquet rug', [ HALF_W / 2, 0.05, -HALF_D / 2], 6, 2, { thickness: 0.02, materialPreset: 'crimson' })
  slab('Library rug', [ HALF_W / 2, 0.05,  HALF_D / 2], 4, 4, { thickness: 0.02, materialPreset: 'velvet' })

  // ----- ROOFS — split into 4 quadrants for visual variety -----
  // Big central gable spanning the whole palace
  roof('Grand Roof', [0, WALL_HEIGHT, 0], HALF_W * 2 + 1.0, HALF_D * 2 + 1.0, 3.2)

  // ----- GARDENS surrounding the palace -----
  slab('Garden north', [0, -0.06,  HALF_D + 6], 30, 8, { materialPreset: 'grass' })
  slab('Garden south', [0, -0.06, -HALF_D - 8], 30, 4, { materialPreset: 'grass' })  // narrower because of portico
  slab('Garden east',  [ HALF_W + 5, -0.06, 0], 6, 24, { materialPreset: 'grass' })
  slab('Garden west',  [-HALF_W - 5, -0.06, 0], 6, 24, { materialPreset: 'grass' })

  // ----- Reflecting pool in front of the entrance -----
  slab('Reflecting pool', [0, 0.0, -HALF_D - 9], 8, 2, { thickness: 0.05, materialPreset: 'water' })

  // ----- WRAP UP: hierarchy ----
  const level = {
    object: 'node',
    id: levelId,
    type: 'level',
    name: 'Palace Level 0',
    parentId: buildingId,
    visible: true,
    metadata: {},
    level: 0,
    children: childIds,
  }
  const building = {
    object: 'node',
    id: buildingId,
    type: 'building',
    name: 'Royal Palace',
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
    name: 'Palace Grounds',
    parentId: null,
    visible: true,
    metadata: {},
    polygon: { type: 'polygon', points: [[-25, -25], [25, -25], [25, 25], [-25, 25]] },
    children: [building],
  }

  for (const n of [site, building, level, ...all]) {
    nodes.set(n.id, n)
  }
  meta.set('rootNodeIds', [siteId])
})

console.log(`palace built: ${nodes.size} nodes`)
await new Promise((r) => setTimeout(r, 2000))
provider.destroy()
process.exit(0)
