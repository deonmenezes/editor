import * as core from '@pascal-app/core'
import * as store from './scene-store.js'

export type HouseOpts = {
  width: number
  depth: number
  wallHeight: number
  withDoor: boolean
  windowCount: number
  withDivider: boolean
  withRoof: boolean
  clear: boolean
}

export async function buildSimpleHouse(opts: HouseOpts): Promise<{
  walls: string[]
  doorId?: string
  windowIds: string[]
  roofId?: string
}> {
  if (opts.clear) store.clear()

  const levelId = store.getLevelId()
  if (!levelId) throw new Error('No level node found')

  const halfW = opts.width / 2
  const halfD = opts.depth / 2
  const wallProps = { thickness: 0.2, height: opts.wallHeight }

  const south = core.WallNode.parse({
    parentId: levelId,
    name: 'South Wall',
    start: [-halfW, -halfD],
    end: [halfW, -halfD],
    ...wallProps,
  })
  const north = core.WallNode.parse({
    parentId: levelId,
    name: 'North Wall',
    start: [-halfW, halfD],
    end: [halfW, halfD],
    ...wallProps,
  })
  const west = core.WallNode.parse({
    parentId: levelId,
    name: 'West Wall',
    start: [-halfW, -halfD],
    end: [-halfW, halfD],
    ...wallProps,
  })
  const east = core.WallNode.parse({
    parentId: levelId,
    name: 'East Wall',
    start: [halfW, -halfD],
    end: [halfW, halfD],
    ...wallProps,
  })

  const walls = [south, north, west, east]
  if (opts.withDivider) {
    walls.push(
      core.WallNode.parse({
        parentId: levelId,
        name: 'Interior',
        start: [0, -halfD],
        end: [0, halfD],
        ...wallProps,
      }),
    )
  }
  for (const w of walls) store.addNode(w)

  let doorId: string | undefined
  if (opts.withDoor) {
    const door = core.DoorNode.parse({
      parentId: south.id,
      wallId: south.id,
      name: 'Front Door',
      position: [0, 1.05, 0],
      width: 0.9,
      height: 2.1,
    })
    store.addNode(door)
    doorId = door.id
  }

  const windowIds: string[] = []
  if (opts.windowCount > 0) {
    type WP = { wall: typeof south; name: string; x: number }
    const wins: WP[] = []
    if (opts.windowCount >= 1) wins.push({ wall: north, name: 'Window N1', x: -opts.width / 4 })
    if (opts.windowCount >= 2) wins.push({ wall: north, name: 'Window N2', x: opts.width / 4 })
    if (opts.windowCount >= 3) wins.push({ wall: east, name: 'Window E', x: 0 })
    if (opts.windowCount >= 4) wins.push({ wall: west, name: 'Window W', x: 0 })
    for (const wn of wins) {
      const win = core.WindowNode.parse({
        parentId: wn.wall.id,
        wallId: wn.wall.id,
        name: wn.name,
        position: [wn.x, 1.5, 0],
        width: 1.4,
        height: 1.2,
      })
      store.addNode(win)
      windowIds.push(win.id)
    }
  }

  let roofId: string | undefined
  if (opts.withRoof) {
    const segId = core.generateId('rseg')
    const roof = core.RoofNode.parse({
      parentId: levelId,
      position: [0, opts.wallHeight, 0],
      children: [segId],
    })
    store.addNode(roof)
    store.addNode(
      core.RoofSegmentNode.parse({
        id: segId,
        parentId: roof.id,
        roofType: 'gable',
        width: opts.width + 0.4,
        depth: opts.depth + 0.4,
        wallHeight: 0,
        roofHeight: 1.8,
      }),
    )
    roofId = roof.id
  }

  return {
    walls: walls.map((w) => w.id),
    doorId,
    windowIds,
    roofId,
  }
}
