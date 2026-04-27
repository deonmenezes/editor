'use client'
import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { useYDoc } from './y-doc-provider'

type AnyNode = {
  id: string
  type: string
  name?: string
  parentId?: string | null
  position?: [number, number, number]
  rotation?: number | [number, number, number]
  start?: [number, number]
  end?: [number, number]
  thickness?: number
  height?: number
  width?: number
  depth?: number
  roofHeight?: number
}

export function WorldMeshes() {
  const { nodes } = useYDoc()
  const [snapshot, setSnapshot] = useState<AnyNode[]>([])

  useEffect(() => {
    const sync = () => setSnapshot(Array.from(nodes.values()) as AnyNode[])
    sync()
    nodes.observeDeep(sync)
    return () => nodes.unobserveDeep(sync)
  }, [nodes])

  const nodeById = new Map(snapshot.map((n) => [n.id, n] as const))

  return (
    <>
      {snapshot.map((n) => {
        if (n.type === 'wall') return <Wall key={n.id} n={n} />
        if (n.type === 'roof-segment') return <RoofSegment key={n.id} n={n} parents={nodeById} />
        if (n.type === 'slab') return <Slab key={n.id} n={n} />
        return null
      })}
    </>
  )
}

function Wall({ n }: { n: AnyNode }) {
  if (!n.start || !n.end) return null
  const [x1, z1] = n.start
  const [x2, z2] = n.end
  const dx = x2 - x1
  const dz = z2 - z1
  const length = Math.hypot(dx, dz)
  if (length < 1e-6) return null
  const thickness = n.thickness ?? 0.2
  const height = n.height ?? 2.7
  const cx = (x1 + x2) / 2
  const cz = (z1 + z2) / 2
  const cy = height / 2
  const angleY = Math.atan2(-dz, dx) // glTF/three: +Y up, R_y(θ) maps +X → (cosθ, 0, -sinθ)

  return (
    <mesh position={[cx, cy, cz]} rotation={[0, angleY, 0]} castShadow receiveShadow>
      <boxGeometry args={[length, height, thickness]} />
      <meshStandardMaterial color="#f0ede5" roughness={0.85} />
    </mesh>
  )
}

function Slab({ n }: { n: AnyNode }) {
  const w = n.width ?? 8
  const d = n.depth ?? 6
  const t = (n as { thickness?: number }).thickness ?? 0.1
  const pos = n.position ?? [0, -t / 2, 0]
  const preset = (n as { materialPreset?: string }).materialPreset
  // Lightweight palette so pool water / grass / etc render distinctively
  // without needing to ship the full material library.
  let color = '#a8a8a8'
  let roughness = 0.95
  let metalness = 0
  let opacity = 1
  let transparent = false
  if (preset === 'water') {
    color = '#3aa9d4'
    roughness = 0.15
    metalness = 0.1
    opacity = 0.85
    transparent = true
  } else if (preset === 'grass') {
    color = '#5a8a3f'
  } else if (preset === 'wood') {
    color = '#8a6a3f'
    roughness = 0.6
  }
  return (
    <mesh position={[pos[0], pos[1], pos[2]]} receiveShadow>
      <boxGeometry args={[w, t, d]} />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        transparent={transparent}
        opacity={opacity}
      />
    </mesh>
  )
}

function RoofSegment({ n, parents }: { n: AnyNode; parents: Map<string, AnyNode> }) {
  const parent = n.parentId ? parents.get(n.parentId) : null
  const parentPos = parent?.position ?? ([0, 0, 0] as [number, number, number])
  const w = n.width ?? 8
  const d = n.depth ?? 6
  const h = n.roofHeight ?? 1.8
  const rotation = typeof n.rotation === 'number' ? n.rotation : 0

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(gablePositions(w, h, d), 3))
    g.setAttribute('normal', new THREE.BufferAttribute(gableNormals(w, h, d), 3))
    return g
  }, [w, h, d])

  return (
    <group position={parentPos} rotation={[0, rotation, 0]}>
      <mesh castShadow geometry={geometry}>
        <meshStandardMaterial color="#8a4a3a" roughness={0.9} />
      </mesh>
    </group>
  )
}

// Triangular prism (gable) — 18 vertices (6 triangles × 3 verts) for flat shading
function gablePositions(w: number, h: number, d: number): Float32Array {
  const hw = w / 2
  const hd = d / 2
  // 6 corners
  const v = {
    BL_back: [-hw, 0, -hd] as const,
    BR_back: [hw, 0, -hd] as const,
    BL_front: [-hw, 0, hd] as const,
    BR_front: [hw, 0, hd] as const,
    R_back: [0, h, -hd] as const,
    R_front: [0, h, hd] as const,
  }
  const tri = (a: readonly number[], b: readonly number[], c: readonly number[]) => [
    ...a,
    ...b,
    ...c,
  ]
  return new Float32Array([
    // left slope (two triangles)
    ...tri(v.BL_back, v.BL_front, v.R_front),
    ...tri(v.BL_back, v.R_front, v.R_back),
    // right slope
    ...tri(v.R_back, v.R_front, v.BR_front),
    ...tri(v.R_back, v.BR_front, v.BR_back),
    // front gable
    ...tri(v.BL_front, v.BR_front, v.R_front),
    // back gable
    ...tri(v.BR_back, v.BL_back, v.R_back),
  ])
}

function gableNormals(w: number, h: number, _d: number): Float32Array {
  const hw = w / 2
  const slopeLen = Math.hypot(hw, h)
  const nL = [-h / slopeLen, hw / slopeLen, 0]
  const nR = [h / slopeLen, hw / slopeLen, 0]
  const repeat = (n: number[], count: number) =>
    Array.from({ length: count }, () => n).flat()
  return new Float32Array([
    ...repeat(nL, 6), // left slope
    ...repeat(nR, 6), // right slope
    ...repeat([0, 0, 1], 3), // front gable
    ...repeat([0, 0, -1], 3), // back gable
  ])
}
