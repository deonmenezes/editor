# Pascal — shared world

> A 3D building world that anyone can edit through Claude.
> One world. CRDT-replicated. No central editor.

🌐 **Live website**: https://editor-six-indol.vercel.app
🔌 **Live relay**: `wss://pascal-relay-deonmenezes.fly.dev`
📦 **Repo**: https://github.com/deonmenezes/editor

---

## Try it (60 seconds)

Open https://editor-six-indol.vercel.app — you're now in the world. Orbit / zoom with the mouse. The status panel in the top-left shows the relay state and how many peers are online with you. Whatever's there was built by someone with the Pascal Claude plugin installed.

## Build in it (5 minutes)

You need [Claude Desktop](https://claude.ai/download) or [Claude Code](https://claude.com/claude-code), and Node 18+.

```bash
git clone https://github.com/deonmenezes/editor.git
cd editor
bun install            # or `npm install`
bun run build
```

Then add this to `~/.claude.json` (or `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "pascal": {
      "command": "node",
      "args": ["/absolute/path/to/editor/packages/mcp/dist/index.js"],
      "env": {
        "PASCAL_RELAY_URL": "wss://pascal-relay-deonmenezes.fly.dev",
        "PASCAL_ROOM": "pascal-shared-world-deonmenezes"
      }
    }
  }
}
```

Restart Claude. Now ask:

> *"Build me a small house with two windows, then export it as a glb."*

Watch it happen on the website in real time.

If you want, drop the agent-facing skill at [`.claude/skills/pascal-build.md`](./.claude/skills/pascal-build.md) into your own Claude config — it teaches the model how to use these tools well.

## Host your own (20 minutes)

Step-by-step in [ONBOARDING.md](./ONBOARDING.md). Short version: deploy `packages/relay` to Fly.io (or any host with WebSocket support), deploy `packages/web` to Vercel, point the web's env at your relay, point your Claude plugin at it too.

---

## Architecture

```
   ┌──────────────────────────────────────────────────────┐
   │  Vercel-hosted website (packages/web)                │
   │  Next.js + React Three Fiber                         │
   │  Loads the world live, renders walls/roofs/slabs     │
   └────────────────────────────┬─────────────────────────┘
                                │ y-websocket
                                ▼
   ┌──────────────────────────────────────────────────────┐
   │  Relay (packages/relay) — on Fly.io                  │
   │  Stateless WebSocket router for CRDT messages        │
   │  Holds NO app state — every peer carries the doc     │
   └────────────────────────────▲─────────────────────────┘
                                │ y-websocket
   ┌────────────────────────────┴─────────────────────────┐
   │  Claude plugin (packages/mcp)                        │
   │  Each user's machine. Tools: wall_add, door_add, …   │
   │  Edits go straight into a shared Y.Doc               │
   └──────────────────────────────────────────────────────┘
```

The relay is the only centralized piece. It just routes encrypted CRDT messages between peers; turn it off and the doc still lives in everyone's local Y.Doc. **Anyone can run their own relay**, and the doc happily syncs to it.

## Layout

| Package | Role |
|---------|------|
| `packages/core` | Zod schemas for nodes (wall, door, window, roof, …) — pure data |
| `packages/mcp` | Claude plugin. MCP stdio server backed by a Y.Doc |
| `packages/relay` | y-websocket relay. Stateless. Deploy anywhere |
| `packages/web` | Next.js + R3F viewer. Joins the swarm and renders 3D |

## MCP tools

| Tool | Purpose |
|------|---------|
| `world_status` | Connection state to the relay |
| `scene_summary` | Text tree of the current world (the model's "vision") |
| `scene_clear` | Wipe the shared scene back to defaults |
| `wall_add` | Add a wall — `start` and `end` are `[x, z]` floor coordinates |
| `door_add` / `window_add` | Add openings to a wall |
| `roof_add` | Single-segment roof on the level |
| `node_delete` | Delete nodes (cascades to descendants) |
| `house_build` | One-shot: rectangle + door + windows + gable roof |
| `scene_export_glb` | Export to a `.glb` you can open in Blender / model-viewer / VS Code |
| `scene_save` / `scene_load` | Local snapshot of the doc to JSON |

Coordinate system: `[x, z]` on the floor plan, in metres. `y=0` is the floor; positive `y` is up. glTF output is right-handed Y-up.

## Limits called out honestly

- **WebRTC mesh isn't on yet.** Sync currently goes through the relay. The single shared-cpu Fly machine handles a few hundred concurrent peers comfortably; beyond that, mesh + sticky-session sharding is the next pass.
- **Anyone can edit anything.** Y.js gives full edit history for free; a moderator-undo button on the website is a planned mitigation.
- **No persistence beyond the relay's memory yet.** If everyone disconnects and the relay restarts, the world is lost. IPFS snapshots are queued for the next phase — the world's Y-update binary blob would be pinned periodically and re-applied on relay boot.

## License

MIT
