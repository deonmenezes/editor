# Pascal — shared world

A 3D building world that anyone can edit through Claude. One world, millions of potential builders, no central server holds the truth — state lives in a CRDT replicated across every connected peer.

## Architecture

```
   ┌─────────────────────────────────────────────────────────┐
   │  Vercel-hosted website (packages/web)                   │
   │  Next.js + React Three Fiber                            │
   │  Loads the world live, renders walls/roofs/slabs       │
   └────────────────────────────┬────────────────────────────┘
                                │ y-websocket
                                ▼
   ┌─────────────────────────────────────────────────────────┐
   │  Relay (packages/relay)                                 │
   │  Stateless WebSocket router for CRDT messages           │
   │  Holds NO app state — every peer carries the doc        │
   │  Deploy to Fly.io / Railway / a tiny VM                 │
   └────────────────────────────▲────────────────────────────┘
                                │ y-websocket
   ┌────────────────────────────┴────────────────────────────┐
   │  Claude plugin (packages/mcp)                           │
   │  Each user's machine. Tools: wall_add, door_add, …     │
   │  Edits go straight into a shared Y.Doc                  │
   └─────────────────────────────────────────────────────────┘
```

**The relay is the only centralized piece.** It just routes encrypted CRDT messages between peers; turn it off and the doc still lives in everyone's local Y.Doc. Anyone can run their own relay.

## Layout

```
packages/
├── core/      Zod schemas for nodes (wall, door, window, roof, …)
├── mcp/       Claude plugin. MCP stdio server backed by a Y.Doc
├── relay/     Tiny y-websocket relay. Stateless. Deploy anywhere.
└── web/       Next.js viewer. Joins the same Y.Doc swarm and renders 3D.
```

## Run locally (full stack)

```bash
bun install
bun run build

# Terminal 1 — relay
node packages/relay/dist/index.js
# → pascal-relay listening on ws://0.0.0.0:1234

# Terminal 2 — viewer (open http://localhost:3000)
NEXT_PUBLIC_PASCAL_RELAY_URL=ws://localhost:1234 \
NEXT_PUBLIC_PASCAL_ROOM=pascal-world \
  bun run --cwd packages/web dev

# Terminal 3 — Claude (or any MCP client) drives edits
PASCAL_RELAY_URL=ws://localhost:1234 \
PASCAL_ROOM=pascal-world \
  node packages/mcp/dist/index.js
```

When you build a wall through Claude in terminal 3, it shows up in the browser in terminal 2 within ~50ms.

## Wire to Claude

```json
{
  "mcpServers": {
    "pascal": {
      "command": "node",
      "args": ["C:/Users/YOU/editor/packages/mcp/dist/index.js"],
      "env": {
        "PASCAL_RELAY_URL": "wss://your-relay.example.com",
        "PASCAL_ROOM": "pascal-world"
      }
    }
  }
}
```

Without `PASCAL_RELAY_URL` the plugin works fine offline — your edits live in your own Y.Doc and persist to `scene.json`.

## MCP tools

| Tool | Purpose |
|------|---------|
| `world_status` | Connection state to the relay |
| `scene_summary` | Text tree of the current world |
| `scene_clear` | Wipe and reset the shared scene to defaults |
| `wall_add` | Add a wall (`start`, `end` in floor-plan [x, z]) |
| `door_add` / `window_add` | Add openings to a wall |
| `roof_add` | Single-segment roof |
| `node_delete` | Delete nodes (cascades to descendants) |
| `house_build` | One-shot helper: rectangle + door + windows + gable roof |
| `scene_export_glb` | Snapshot to a `.glb` you can open in Blender |
| `scene_save` / `scene_load` | Local snapshot of the doc to JSON |

## Deploying

### Relay

Any host with WebSocket support works. Examples:

```bash
# Fly.io
cd packages/relay
fly launch --no-deploy
fly deploy

# Railway / Render — point at packages/relay, run `npm start`
# DigitalOcean / Hetzner / a Pi at home — run `node dist/index.js`
```

The relay is stateless and tiny (~1 KB bundle); a $5 VM can comfortably host hundreds of concurrent peers.

### Website

```bash
cd packages/web
vercel
# Set env: NEXT_PUBLIC_PASCAL_RELAY_URL, NEXT_PUBLIC_PASCAL_ROOM
```

## Limits to be honest about

- WebRTC mesh isn't on yet — sync goes through the relay. At a few hundred concurrent peers the relay starts to be a bottleneck. Fix: turn on `y-webrtc` for browser peers (mesh among browsers, MCPs still relay) — a few hours of work.
- *Anyone can edit* means anyone can also delete everything. Y.js gives full edit history; a "moderator undo" UI on the website is the planned mitigation.
- IPFS snapshot persistence (so the world survives the relay GC'ing the doc) is staged for the next pass — currently the world lives in the relay's memory while at least one peer is connected.

## License

MIT
