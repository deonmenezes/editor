'use client'
import { OrbitControls, Sky, Stats } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { WorldMeshes } from './world-meshes'
import { WorldStatus } from './world-status'
import { useYDoc } from './y-doc-provider'
import { YDocProvider } from './y-doc-provider'

export function WorldViewer({ relayUrl, room }: { relayUrl: string; room: string }) {
  return (
    <YDocProvider relayUrl={relayUrl} room={room}>
      <ViewerInner />
    </YDocProvider>
  )
}

function ViewerInner() {
  const { connected, room, peerCount } = useYDoc()
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Canvas shadows camera={{ position: [12, 9, 14], fov: 45 }}>
        <Sky sunPosition={[100, 30, 100]} />
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[20, 30, 10]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <gridHelper args={[60, 60, '#202030', '#101018']} />
        <Suspense fallback={null}>
          <WorldMeshes />
        </Suspense>
        <OrbitControls makeDefault target={[0, 1.4, 0]} />
        <Stats />
      </Canvas>
      <WorldStatus connected={connected} room={room} peerCount={peerCount} />
    </div>
  )
}
