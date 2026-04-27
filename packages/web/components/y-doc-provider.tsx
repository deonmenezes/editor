'use client'
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'

type Ctx = {
  doc: Y.Doc
  nodes: Y.Map<unknown>
  connected: boolean
  room: string
  peerCount: number
}

const YCtx = createContext<Ctx | null>(null)

export function useYDoc(): Ctx {
  const ctx = useContext(YCtx)
  if (!ctx) throw new Error('YDocProvider missing')
  return ctx
}

export function YDocProvider({
  relayUrl,
  room,
  children,
}: {
  relayUrl: string
  room: string
  children: React.ReactNode
}) {
  const [connected, setConnected] = useState(false)
  const [peerCount, setPeerCount] = useState(0)
  const docRef = useRef<Y.Doc | null>(null)
  const providerRef = useRef<WebsocketProvider | null>(null)

  if (!docRef.current) docRef.current = new Y.Doc()
  const doc = docRef.current
  const nodes = useMemo(() => doc.getMap('nodes'), [doc])

  useEffect(() => {
    const provider = new WebsocketProvider(relayUrl, room, doc, { connect: true })
    providerRef.current = provider

    const onStatus = (e: { status: string }) => setConnected(e.status === 'connected')
    const onAwareness = () => {
      const states = provider.awareness?.getStates()
      setPeerCount(states ? states.size : 0)
    }
    provider.on('status', onStatus)
    provider.awareness?.on('change', onAwareness)
    onAwareness()

    return () => {
      provider.off('status', onStatus)
      provider.awareness?.off('change', onAwareness)
      provider.destroy()
    }
  }, [relayUrl, room, doc])

  const value = useMemo(
    () => ({ doc, nodes, connected, room, peerCount }),
    [doc, nodes, connected, room, peerCount],
  )
  return <YCtx.Provider value={value}>{children}</YCtx.Provider>
}
