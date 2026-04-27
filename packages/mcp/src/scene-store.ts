import { existsSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as core from '@pascal-app/core'
import WebSocket from 'ws'
import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'
import type { z } from 'zod'

type AnyNode = z.infer<typeof core.AnyNode>

export type SceneData = {
  nodes: Record<string, AnyNode>
  rootNodeIds: string[]
}

const doc = new Y.Doc()
const yNodes = doc.getMap<AnyNode>('nodes')
const yMeta = doc.getMap<unknown>('meta')

let scenePath: string = path.resolve(process.env.PASCAL_SCENE_PATH ?? './scene.json')
let provider: WebsocketProvider | null = null

export function getDoc(): Y.Doc {
  return doc
}

export function getScenePath(): string {
  return scenePath
}

export function setScenePath(p: string): void {
  scenePath = path.resolve(p)
}

function getRootIds(): string[] {
  return (yMeta.get('rootNodeIds') as string[] | undefined) ?? []
}

export function getState(): SceneData {
  return {
    nodes: Object.fromEntries(yNodes.entries()),
    rootNodeIds: getRootIds(),
  }
}

export function initDefault(): void {
  // SiteNode.children expects building/item *objects* (not ids). BuildingNode
  // expects level *ids*.
  const level = core.LevelNode.parse({ level: 0 })
  const building = core.BuildingNode.parse({ children: [level.id] })
  const site = core.SiteNode.parse({ children: [building] })
  level.parentId = building.id
  building.parentId = site.id
  doc.transact(() => {
    yNodes.clear()
    yNodes.set(site.id, site as AnyNode)
    yNodes.set(building.id, building as AnyNode)
    yNodes.set(level.id, level as AnyNode)
    yMeta.set('rootNodeIds', [site.id])
  })
}

export function clear(): void {
  initDefault()
}

function applySnapshot(snapshot: SceneData): void {
  doc.transact(() => {
    yNodes.clear()
    for (const [id, node] of Object.entries(snapshot.nodes)) {
      yNodes.set(id, node)
    }
    yMeta.set('rootNodeIds', snapshot.rootNodeIds ?? [])
  })
}

export async function loadFromDisk(p?: string): Promise<SceneData> {
  if (p) setScenePath(p)
  if (!existsSync(scenePath)) {
    if (yNodes.size === 0) initDefault()
    await saveToDisk()
    return getState()
  }
  const json = await fs.readFile(scenePath, 'utf-8')
  const parsed = JSON.parse(json) as SceneData
  applySnapshot(parsed)
  return getState()
}

export async function saveToDisk(p?: string): Promise<string> {
  if (p) setScenePath(p)
  await fs.mkdir(path.dirname(scenePath), { recursive: true })
  await fs.writeFile(scenePath, JSON.stringify(getState(), null, 2))
  return scenePath
}

export function addNode(node: AnyNode): void {
  doc.transact(() => {
    yNodes.set(node.id, node)
    if (node.parentId) {
      const parent = yNodes.get(node.parentId)
      if (parent && Array.isArray((parent as AnyNode & { children?: unknown[] }).children)) {
        const parentChildren = (parent as AnyNode & { children: unknown[] }).children
        // Children may be string ids (level/building) or objects (site).
        const alreadyPresent = parentChildren.some((c) =>
          typeof c === 'string' ? c === node.id : (c as { id?: string }).id === node.id,
        )
        if (!alreadyPresent) {
          const updatedParent = {
            ...(parent as AnyNode & { children: unknown[] }),
            children: [...parentChildren, node.id],
          }
          yNodes.set(node.parentId, updatedParent as AnyNode)
        }
      }
    }
  })
}

export function deleteNodes(ids: string[]): number {
  let removed = 0
  doc.transact(() => {
    const todo = [...ids]
    while (todo.length > 0) {
      const id = todo.shift()
      if (!id) continue
      const n = yNodes.get(id)
      if (!n) continue
      // detach from parent
      if (n.parentId) {
        const parent = yNodes.get(n.parentId)
        if (parent && Array.isArray((parent as AnyNode & { children?: unknown[] }).children)) {
          const parentChildren = (parent as AnyNode & { children: unknown[] }).children
          const filtered = parentChildren.filter((c) =>
            typeof c === 'string' ? c !== id : (c as { id?: string }).id !== id,
          )
          const updatedParent = {
            ...(parent as AnyNode & { children: unknown[] }),
            children: filtered,
          }
          yNodes.set(n.parentId, updatedParent as AnyNode)
        }
      }
      // queue descendants
      const children = (n as AnyNode & { children?: unknown[] }).children
      if (Array.isArray(children)) {
        for (const c of children) {
          const childId = typeof c === 'string' ? c : (c as { id?: string }).id
          if (childId) todo.push(childId)
        }
      }
      yNodes.delete(id)
      removed++
    }
  })
  return removed
}

export function getLevelId(): string | null {
  for (const n of yNodes.values()) {
    if (n.type === 'level') return n.id
  }
  return null
}

export function getNode(id: string): AnyNode | undefined {
  return yNodes.get(id)
}

export type SyncStatus = {
  enabled: boolean
  url?: string
  room?: string
  connected?: boolean
}

export function startSync(url: string, room: string): SyncStatus {
  if (provider) provider.destroy()
  provider = new WebsocketProvider(url, room, doc, {
    WebSocketPolyfill: WebSocket as unknown as typeof globalThis.WebSocket,
    connect: true,
  })
  return { enabled: true, url, room, connected: provider.wsconnected }
}

export function stopSync(): void {
  if (provider) {
    provider.destroy()
    provider = null
  }
}

export function getSyncStatus(): SyncStatus {
  if (!provider) return { enabled: false }
  return {
    enabled: true,
    url: provider.url,
    room: provider.roomname,
    connected: provider.wsconnected,
  }
}

export async function awaitSyncReady(timeoutMs = 4000): Promise<boolean> {
  if (!provider) return false
  if (provider.wsconnected && provider.synced) return true
  return await new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs)
    const onSync = (synced: boolean) => {
      if (synced) {
        clearTimeout(timer)
        provider?.off('sync', onSync)
        resolve(true)
      }
    }
    provider?.on('sync', onSync)
  })
}
