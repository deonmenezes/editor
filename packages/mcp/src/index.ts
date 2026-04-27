#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import * as store from './scene-store.js'
import { tools } from './tools.js'

const server = new Server(
  { name: 'pascal-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: Object.values(tools).map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  })),
}))

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const name = req.params.name
  const args = (req.params.arguments ?? {}) as Record<string, unknown>
  const tool = tools[name]
  if (!tool) {
    return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true }
  }
  try {
    const result = await tool.handler(args)
    const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2)
    return { content: [{ type: 'text', text }] }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    }
  }
})

await store.loadFromDisk()

const relayUrl = process.env.PASCAL_RELAY_URL
const room = process.env.PASCAL_ROOM ?? 'pascal-world'
if (relayUrl) {
  store.startSync(relayUrl, room)
  // Allow a brief window to receive the remote doc state before serving tool calls
  await store.awaitSyncReady(3500)
}

const transport = new StdioServerTransport()
await server.connect(transport)
