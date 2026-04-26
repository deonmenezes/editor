import * as core from '@pascal-app/core'
import { buildSimpleHouse } from './builders.js'
import { exportGLB } from './glb.js'
import * as store from './scene-store.js'

export type ToolDef = {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  handler: (args: Record<string, unknown>) => Promise<string | object>
}

export const tools: Record<string, ToolDef> = {}

function reg(t: ToolDef): void {
  tools[t.name] = t
}

function summarize(): string {
  const s = store.getState()
  const nodes = s.nodes
  const lines: string[] = [
    `Scene: ${Object.keys(nodes).length} nodes (path: ${store.getScenePath()})`,
  ]
  type SummaryNode = {
    id: string
    type: string
    name?: string
    parentId?: string | null
    children?: string[]
    start?: [number, number]
    end?: [number, number]
    level?: number
    width?: number
    depth?: number
    height?: number
  }
  const walk = (id: string, depth: number) => {
    const n = nodes[id] as undefined | SummaryNode
    if (!n) return
    const indent = '  '.repeat(depth + 1)
    let label = `${n.type}: ${n.name ?? n.id}`
    if (n.type === 'wall' && n.start && n.end) {
      label += ` [${n.start.map((v: number) => v.toFixed(2)).join(', ')} → ${n.end.map((v: number) => v.toFixed(2)).join(', ')}]`
    } else if (n.type === 'level' && typeof n.level === 'number') {
      label = `level ${n.level}: ${n.id}`
    } else if (n.type === 'roof-segment') {
      label += ` (${n.width}×${n.depth}, h=${n.height ?? 'auto'})`
    }
    lines.push(`${indent}${label}`)
    if (Array.isArray(n.children)) {
      for (const c of n.children as unknown[]) {
        const childId = typeof c === 'string' ? c : (c as { id?: string }).id
        if (childId) walk(childId, depth + 1)
      }
    }
  }
  for (const r of s.rootNodeIds) walk(r, 0)
  return lines.join('\n')
}

reg({
  name: 'scene_summary',
  description: 'Return a text-tree summary of the current scene (nodes, hierarchy, key dimensions).',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  handler: async () => summarize(),
})

reg({
  name: 'scene_clear',
  description: 'Wipe the scene and re-initialize a fresh Site → Building → Level hierarchy.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  handler: async () => {
    store.clear()
    await store.saveToDisk()
    return 'Scene cleared.'
  },
})

reg({
  name: 'scene_save',
  description: 'Persist the scene to disk as JSON.',
  inputSchema: {
    type: 'object',
    properties: { path: { type: 'string', description: 'Optional file path. Defaults to PASCAL_SCENE_PATH or ./scene.json' } },
    additionalProperties: false,
  },
  handler: async (a) => {
    const p = await store.saveToDisk(a.path as string | undefined)
    return `Saved scene to ${p}`
  },
})

reg({
  name: 'scene_load',
  description: 'Load a scene from disk JSON. Initializes a default scene if no file exists.',
  inputSchema: {
    type: 'object',
    properties: { path: { type: 'string' } },
    additionalProperties: false,
  },
  handler: async (a) => {
    await store.loadFromDisk(a.path as string | undefined)
    return summarize()
  },
})

reg({
  name: 'wall_add',
  description: 'Add a wall to the current level. Coordinates are [x, z] in meters on the floor plan.',
  inputSchema: {
    type: 'object',
    properties: {
      start: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
      end: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
      thickness: { type: 'number', default: 0.2 },
      height: { type: 'number', default: 2.7 },
      name: { type: 'string' },
    },
    required: ['start', 'end'],
    additionalProperties: false,
  },
  handler: async (a) => {
    const levelId = store.getLevelId()
    if (!levelId) throw new Error('No level node found — call scene_clear first.')
    const wall = core.WallNode.parse({
      parentId: levelId,
      name: a.name as string | undefined,
      start: a.start,
      end: a.end,
      thickness: a.thickness,
      height: a.height,
    })
    store.addNode(wall)
    await store.saveToDisk()
    return { id: wall.id, type: 'wall' }
  },
})

reg({
  name: 'door_add',
  description: 'Add a door to a wall. position is wall-local [x, y, z]; default centered at floor (y=height/2).',
  inputSchema: {
    type: 'object',
    properties: {
      wallId: { type: 'string' },
      position: { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3 },
      width: { type: 'number', default: 0.9 },
      height: { type: 'number', default: 2.1 },
      name: { type: 'string' },
    },
    required: ['wallId'],
    additionalProperties: false,
  },
  handler: async (a) => {
    const wallId = a.wallId as string
    const wall = store.getNode(wallId)
    if (!wall || wall.type !== 'wall') throw new Error(`wallId ${wallId} is not a wall`)
    const height = (a.height as number | undefined) ?? 2.1
    const door = core.DoorNode.parse({
      parentId: wall.id,
      wallId: wall.id,
      name: a.name as string | undefined,
      width: a.width,
      height: a.height,
      position: a.position ?? [0, height / 2, 0],
    })
    store.addNode(door)
    await store.saveToDisk()
    return { id: door.id, type: 'door' }
  },
})

reg({
  name: 'window_add',
  description: 'Add a window to a wall. position is wall-local [x, y, z]; default y=1.5 (sill ~0.9).',
  inputSchema: {
    type: 'object',
    properties: {
      wallId: { type: 'string' },
      position: { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3 },
      width: { type: 'number', default: 1.4 },
      height: { type: 'number', default: 1.2 },
      name: { type: 'string' },
    },
    required: ['wallId'],
    additionalProperties: false,
  },
  handler: async (a) => {
    const wallId = a.wallId as string
    const wall = store.getNode(wallId)
    if (!wall || wall.type !== 'wall') throw new Error(`wallId ${wallId} is not a wall`)
    const win = core.WindowNode.parse({
      parentId: wall.id,
      wallId: wall.id,
      name: a.name as string | undefined,
      width: a.width,
      height: a.height,
      position: a.position ?? [0, 1.5, 0],
    })
    store.addNode(win)
    await store.saveToDisk()
    return { id: win.id, type: 'window' }
  },
})

reg({
  name: 'roof_add',
  description: 'Add a roof on top of the level (single-segment). roofType options: gable, hip, shed, gambrel, dutch, mansard, flat.',
  inputSchema: {
    type: 'object',
    properties: {
      roofType: {
        type: 'string',
        enum: ['gable', 'hip', 'shed', 'gambrel', 'dutch', 'mansard', 'flat'],
        default: 'gable',
      },
      width: { type: 'number' },
      depth: { type: 'number' },
      wallTopY: { type: 'number', description: 'Y position of roof base (top of walls). Default 2.7.' },
      roofHeight: { type: 'number', default: 1.8 },
      overhang: { type: 'number', default: 0.3 },
    },
    required: ['width', 'depth'],
    additionalProperties: false,
  },
  handler: async (a) => {
    const levelId = store.getLevelId()
    if (!levelId) throw new Error('No level node found.')
    const segId = core.generateId('rseg')
    const roof = core.RoofNode.parse({
      parentId: levelId,
      position: [0, (a.wallTopY as number | undefined) ?? 2.7, 0],
      children: [segId],
    })
    store.addNode(roof)
    store.addNode(
      core.RoofSegmentNode.parse({
        id: segId,
        parentId: roof.id,
        roofType: a.roofType ?? 'gable',
        width: a.width,
        depth: a.depth,
        wallHeight: 0,
        roofHeight: a.roofHeight ?? 1.8,
        overhang: a.overhang ?? 0.3,
      }),
    )
    await store.saveToDisk()
    return { roofId: roof.id, segmentId: segId }
  },
})

reg({
  name: 'node_delete',
  description: 'Delete one or more nodes by id (also detaches them from parents and removes descendants).',
  inputSchema: {
    type: 'object',
    properties: { ids: { type: 'array', items: { type: 'string' } } },
    required: ['ids'],
    additionalProperties: false,
  },
  handler: async (a) => {
    const ids = a.ids as string[]
    const removed = store.deleteNodes(ids)
    await store.saveToDisk()
    return `Deleted ${removed} nodes`
  },
})

reg({
  name: 'house_build',
  description:
    'One-shot helper: build a rectangular house with 4 perimeter walls, optional interior divider, optional door, optional windows, and a gable roof. By default wipes existing scene first.',
  inputSchema: {
    type: 'object',
    properties: {
      width: { type: 'number', default: 8 },
      depth: { type: 'number', default: 6 },
      wallHeight: { type: 'number', default: 2.7 },
      withDoor: { type: 'boolean', default: true },
      windowCount: { type: 'number', default: 3 },
      withDivider: { type: 'boolean', default: true },
      withRoof: { type: 'boolean', default: true },
      clear: { type: 'boolean', default: true },
    },
    additionalProperties: false,
  },
  handler: async (a) => {
    const result = await buildSimpleHouse({
      width: (a.width as number | undefined) ?? 8,
      depth: (a.depth as number | undefined) ?? 6,
      wallHeight: (a.wallHeight as number | undefined) ?? 2.7,
      withDoor: a.withDoor !== false,
      windowCount: (a.windowCount as number | undefined) ?? 3,
      withDivider: a.withDivider !== false,
      withRoof: a.withRoof !== false,
      clear: a.clear !== false,
    })
    await store.saveToDisk()
    return result
  },
})

reg({
  name: 'scene_export_glb',
  description: 'Export the scene as a binary glTF (.glb) file. Walls export as boxes, gable roofs as triangular prisms.',
  inputSchema: {
    type: 'object',
    properties: { path: { type: 'string', default: './scene.glb' } },
    additionalProperties: false,
  },
  handler: async (a) => {
    const path = (a.path as string | undefined) ?? './scene.glb'
    const written = await exportGLB(store.getState(), path)
    return `Wrote ${written}`
  },
})
