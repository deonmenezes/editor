#!/usr/bin/env node
import { createServer } from 'node:http'
// y-websocket ships a Node helper that wires WebSocket connections to in-memory
// Y.Doc rooms. The relay holds no app data — peers carry the state.
// @ts-expect-error y-websocket has no published types for the bin helper
import { setupWSConnection } from 'y-websocket/bin/utils'
import { WebSocketServer } from 'ws'

const PORT = Number(process.env.PORT ?? 1234)
const HOST = process.env.HOST ?? '0.0.0.0'

const httpServer = createServer((req, res) => {
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true, service: 'pascal-relay' }))
    return
  }
  res.writeHead(404)
  res.end()
})

const wss = new WebSocketServer({ noServer: true })
wss.on('connection', (conn, req) => {
  setupWSConnection(conn, req, { gc: true })
})

httpServer.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req)
  })
})

httpServer.listen(PORT, HOST, () => {
  console.log(`pascal-relay listening on ws://${HOST}:${PORT}`)
})
