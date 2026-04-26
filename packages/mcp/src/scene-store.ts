import { existsSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { z } from 'zod'
import * as core from '@pascal-app/core'

type AnyNode = z.infer<typeof core.AnyNode>

export type SceneData = {
  nodes: Record<string, AnyNode>
  rootNodeIds: string[]
}

let state: SceneData = { nodes: {}, rootNodeIds: [] }
let scenePath: string = path.resolve(process.env.PASCAL_SCENE_PATH ?? './scene.json')

export function getScenePath(): string {
  return scenePath
}

export function setScenePath(p: string): void {
  scenePath = path.resolve(p)
}

export function getState(): SceneData {
  return state
}

export function initDefault(): void {
  // Note: SiteNode.children expects building/item *objects* (not ids), per the
  // upstream schema. BuildingNode.children expects level *ids* (strings).
  const level = core.LevelNode.parse({ level: 0 })
  const building = core.BuildingNode.parse({ children: [level.id] })
  const site = core.SiteNode.parse({ children: [building] })
  level.parentId = building.id
  building.parentId = site.id
  state = {
    nodes: {
      [site.id]: site as AnyNode,
      [building.id]: building as AnyNode,
      [level.id]: level as AnyNode,
    },
    rootNodeIds: [site.id],
  }
}

export function clear(): void {
  initDefault()
}

export async function loadFromDisk(p?: string): Promise<SceneData> {
  if (p) setScenePath(p)
  if (!existsSync(scenePath)) {
    initDefault()
    await saveToDisk()
    return state
  }
  const json = await fs.readFile(scenePath, 'utf-8')
  state = JSON.parse(json) as SceneData
  return state
}

export async function saveToDisk(p?: string): Promise<string> {
  if (p) setScenePath(p)
  await fs.mkdir(path.dirname(scenePath), { recursive: true })
  await fs.writeFile(scenePath, JSON.stringify(state, null, 2))
  return scenePath
}

export function addNode(node: AnyNode): void {
  state.nodes[node.id] = node
  if (node.parentId && state.nodes[node.parentId]) {
    const parent = state.nodes[node.parentId] as AnyNode & { children?: string[] }
    if (Array.isArray(parent.children) && !parent.children.includes(node.id)) {
      parent.children.push(node.id)
    }
  }
}

export function deleteNodes(ids: string[]): number {
  let removed = 0
  for (const id of ids) {
    const n = state.nodes[id]
    if (!n) continue
    if (n.parentId && state.nodes[n.parentId]) {
      const parent = state.nodes[n.parentId] as AnyNode & { children?: string[] }
      if (Array.isArray(parent.children)) {
        parent.children = parent.children.filter((c: string) => c !== id)
      }
    }
    const node = n as AnyNode & { children?: string[] }
    if (Array.isArray(node.children)) {
      removed += deleteNodes([...node.children])
    }
    delete state.nodes[id]
    removed++
  }
  return removed
}

export function getLevelId(): string | null {
  for (const n of Object.values(state.nodes)) {
    if (n.type === 'level') return n.id
  }
  return null
}

export function getNode(id: string): AnyNode | undefined {
  return state.nodes[id]
}
