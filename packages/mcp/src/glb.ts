import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import {
  type Accessor,
  Document,
  type Material,
  type Mesh,
  NodeIO,
  type Scene as GLTFScene,
} from '@gltf-transform/core'
import type { SceneData } from './scene-store.js'

type Vec3 = [number, number, number]

const FACE_LAYOUT: { n: Vec3; v: Vec3[] }[] = [
  // -X face (left)
  {
    n: [-1, 0, 0],
    v: [
      [-1, -1, -1],
      [-1, -1, 1],
      [-1, 1, 1],
      [-1, 1, -1],
    ],
  },
  // +X face (right)
  {
    n: [1, 0, 0],
    v: [
      [1, -1, 1],
      [1, -1, -1],
      [1, 1, -1],
      [1, 1, 1],
    ],
  },
  // -Y face (bottom)
  {
    n: [0, -1, 0],
    v: [
      [-1, -1, -1],
      [1, -1, -1],
      [1, -1, 1],
      [-1, -1, 1],
    ],
  },
  // +Y face (top)
  {
    n: [0, 1, 0],
    v: [
      [-1, 1, 1],
      [1, 1, 1],
      [1, 1, -1],
      [-1, 1, -1],
    ],
  },
  // -Z face (back)
  {
    n: [0, 0, -1],
    v: [
      [1, -1, -1],
      [-1, -1, -1],
      [-1, 1, -1],
      [1, 1, -1],
    ],
  },
  // +Z face (front)
  {
    n: [0, 0, 1],
    v: [
      [-1, -1, 1],
      [1, -1, 1],
      [1, 1, 1],
      [-1, 1, 1],
    ],
  },
]

function boxGeometry(w: number, h: number, d: number) {
  const hw = w / 2
  const hh = h / 2
  const hd = d / 2
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  FACE_LAYOUT.forEach((face, i) => {
    const base = i * 4
    for (const v of face.v) {
      positions.push(v[0] * hw, v[1] * hh, v[2] * hd)
      normals.push(face.n[0], face.n[1], face.n[2])
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  })
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
  }
}

function gablePrismGeometry(w: number, h: number, d: number) {
  const hw = w / 2
  const hd = d / 2
  // Vertices (each face duplicated for flat shading)
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []

  const pushTri = (n: Vec3, ...verts: Vec3[]) => {
    const base = positions.length / 3
    for (const v of verts) {
      positions.push(v[0], v[1], v[2])
      normals.push(n[0], n[1], n[2])
    }
    if (verts.length === 3) {
      indices.push(base, base + 1, base + 2)
    } else if (verts.length === 4) {
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
    }
  }

  // Two slope faces: left slope (-X side) and right slope (+X side)
  // Slope left: normal points up-left
  const slopeLen = Math.hypot(hw, h)
  const nL: Vec3 = [-h / slopeLen, hw / slopeLen, 0]
  const nR: Vec3 = [h / slopeLen, hw / slopeLen, 0]

  // Left slope quad
  pushTri(
    nL,
    [-hw, 0, -hd],
    [-hw, 0, hd],
    [0, h, hd],
    [0, h, -hd],
  )
  // Right slope quad
  pushTri(
    nR,
    [0, h, -hd],
    [0, h, hd],
    [hw, 0, hd],
    [hw, 0, -hd],
  )
  // Front gable triangle (+Z)
  pushTri([0, 0, 1], [-hw, 0, hd], [hw, 0, hd], [0, h, hd])
  // Back gable triangle (-Z)
  pushTri([0, 0, -1], [hw, 0, -hd], [-hw, 0, -hd], [0, h, -hd])
  // Bottom (rarely seen but close it for cleanliness)
  pushTri(
    [0, -1, 0],
    [-hw, 0, -hd],
    [hw, 0, -hd],
    [hw, 0, hd],
    [-hw, 0, hd],
  )

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
  }
}

function quaternionFromY(angleRad: number): [number, number, number, number] {
  const half = angleRad / 2
  return [0, Math.sin(half), 0, Math.cos(half)]
}

function makeBoxMesh(
  doc: Document,
  name: string,
  w: number,
  h: number,
  d: number,
  material: Material,
): Mesh {
  const { positions, normals, indices } = boxGeometry(w, h, d)
  return makeMeshFromArrays(doc, name, positions, normals, indices, material)
}

function makeMeshFromArrays(
  doc: Document,
  name: string,
  positions: Float32Array,
  normals: Float32Array,
  indices: Uint16Array,
  material: Material,
): Mesh {
  const buf = doc.getRoot().listBuffers()[0]!
  // gltf-transform's TypedArray constraint is `<ArrayBuffer>`; TS 5+ widens our
  // typed arrays to `<ArrayBufferLike>` — cast through unknown.
  const posAcc: Accessor = doc
    .createAccessor()
    .setType('VEC3')
    .setArray(positions as unknown as never)
    .setBuffer(buf)
  const nrmAcc: Accessor = doc
    .createAccessor()
    .setType('VEC3')
    .setArray(normals as unknown as never)
    .setBuffer(buf)
  const idxAcc: Accessor = doc
    .createAccessor()
    .setType('SCALAR')
    .setArray(indices as unknown as never)
    .setBuffer(buf)
  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', posAcc)
    .setAttribute('NORMAL', nrmAcc)
    .setIndices(idxAcc)
    .setMaterial(material)
  return doc.createMesh(name).addPrimitive(prim)
}

export async function exportGLB(scene: SceneData, outPath: string): Promise<string> {
  const doc = new Document()
  doc.createBuffer()
  const sceneNode: GLTFScene = doc.createScene('Pascal')

  const wallMat = doc
    .createMaterial('wall')
    .setBaseColorFactor([0.95, 0.95, 0.92, 1])
    .setMetallicFactor(0)
    .setRoughnessFactor(0.85)

  const roofMat = doc
    .createMaterial('roof')
    .setBaseColorFactor([0.55, 0.32, 0.28, 1])
    .setMetallicFactor(0)
    .setRoughnessFactor(0.9)

  const slabMat = doc
    .createMaterial('slab')
    .setBaseColorFactor([0.7, 0.7, 0.7, 1])
    .setMetallicFactor(0)
    .setRoughnessFactor(0.95)

  for (const node of Object.values(scene.nodes)) {
    if (node.type === 'wall') {
      const w = node as typeof node & {
        start: [number, number]
        end: [number, number]
        thickness?: number
        height?: number
      }
      const [x1, z1] = w.start
      const [x2, z2] = w.end
      const dx = x2 - x1
      const dz = z2 - z1
      const length = Math.hypot(dx, dz)
      if (length < 1e-6) continue
      const thickness = w.thickness ?? 0.2
      const height = w.height ?? 2.7
      const cx = (x1 + x2) / 2
      const cz = (z1 + z2) / 2
      const cy = height / 2
      // glTF is right-handed, +Y up. Rotate around Y to align local X with (dx,dz).
      // R_y(θ) maps +X to (cosθ, 0, -sinθ); we want (dx, 0, dz)/length -> θ = atan2(-dz, dx)
      const angleY = Math.atan2(-dz, dx)
      const mesh = makeBoxMesh(doc, w.name ?? w.id, length, height, thickness, wallMat)
      const n = doc
        .createNode(w.name ?? w.id)
        .setMesh(mesh)
        .setTranslation([cx, cy, cz])
        .setRotation(quaternionFromY(angleY))
      sceneNode.addChild(n)
    } else if (node.type === 'slab') {
      const s = node as typeof node & {
        position?: [number, number, number]
        width?: number
        depth?: number
        thickness?: number
      }
      const w = s.width ?? 8
      const d = s.depth ?? 6
      const t = s.thickness ?? 0.1
      const pos = s.position ?? [0, -t / 2, 0]
      const mesh = makeBoxMesh(doc, s.name ?? s.id, w, t, d, slabMat)
      const n = doc
        .createNode(s.name ?? s.id)
        .setMesh(mesh)
        .setTranslation([pos[0], pos[1], pos[2]])
      sceneNode.addChild(n)
    } else if (node.type === 'roof-segment') {
      const r = node as typeof node & {
        width: number
        depth: number
        roofHeight: number
        wallHeight: number
        rotation: number
      }
      const parent = scene.nodes[node.parentId ?? '']
      const parentPos = (parent && (parent as { position?: Vec3 }).position) ?? ([0, 0, 0] as Vec3)
      const { positions, normals, indices } = gablePrismGeometry(r.width, r.roofHeight, r.depth)
      const mesh = makeMeshFromArrays(
        doc,
        node.name ?? node.id,
        positions,
        normals,
        indices,
        roofMat,
      )
      const n = doc
        .createNode(node.name ?? node.id)
        .setMesh(mesh)
        .setTranslation([parentPos[0], parentPos[1], parentPos[2]])
        .setRotation(quaternionFromY(r.rotation ?? 0))
      sceneNode.addChild(n)
    }
  }

  const io = new NodeIO()
  const bin = await io.writeBinary(doc)
  const resolved = path.resolve(outPath)
  await fs.mkdir(path.dirname(resolved), { recursive: true })
  await fs.writeFile(resolved, Buffer.from(bin))
  return resolved
}
