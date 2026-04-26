# Pascal MCP

An AI-native 3D building editor — controlled exclusively through MCP tools, no UI.

The original `pascalorg/editor` was a Next.js + React Three Fiber app for humans. This fork strips the UI and exposes the underlying schema as a Model Context Protocol server. Claude (or any MCP client) drives the scene by calling tools; output is a `scene.json` plus an exportable `scene.glb` you can open in Blender, Three.js viewers, VS Code's glTF preview, etc.

## Layout

```
packages/
├── core/        @pascal-app/core — Zod schemas for nodes (wall, door, window, roof, …)
└── mcp/         @pascal-app/mcp — MCP stdio server with tools and GLB exporter
tooling/
└── typescript/  shared tsconfigs
```

## Install + build

```bash
bun install
bun run build
```

This produces `packages/mcp/dist/index.js` (the MCP server entrypoint).

## Run the server (manual)

```bash
node packages/mcp/dist/index.js
```

It speaks MCP over stdio. Scene state lives in `./scene.json` by default — override with `PASCAL_SCENE_PATH=/abs/path/scene.json`.

## Tools

| Tool | Purpose |
|------|---------|
| `scene_summary` | Text tree of nodes, ids, key dims |
| `scene_clear` | Wipe and recreate Site → Building → Level |
| `scene_save` / `scene_load` | Persist scene JSON |
| `wall_add` | Add a wall (`start`, `end` in floor-plan [x,z]) |
| `door_add` / `window_add` | Add an opening to a wall |
| `roof_add` | Single-segment roof on the level |
| `node_delete` | Delete nodes by id (cascades to descendants) |
| `house_build` | One-shot: rectangle + door + windows + gable roof |
| `scene_export_glb` | Write `.glb` (boxes for walls, prisms for gable roofs) |

## Wire to Claude

### Claude Desktop / Claude Code (MCP server)

Add to your `claude_desktop_config.json` or `~/.claude.json`:

```json
{
  "mcpServers": {
    "pascal": {
      "command": "node",
      "args": ["C:/Users/YOU/editor/packages/mcp/dist/index.js"],
      "env": {
        "PASCAL_SCENE_PATH": "C:/Users/YOU/pascal-scenes/current.json"
      }
    }
  }
}
```

Then restart Claude. The tools appear under the `pascal` server.

### Claude Code plugin

`claude-plugin.json` ships at the repo root. Install via `claude plugin install <path-to-this-repo>`.

## Example session

```
> "build me a house, then export it"
Claude calls: house_build {width: 8, depth: 6}
Claude calls: scene_export_glb {path: "./house.glb"}
→ open house.glb in Blender / VS Code
```

## Why no UI?

The interesting surface for an LLM is the *schema*, not the canvas. Walls are line segments with thickness and height; doors are openings with position and dimensions. The original repo wraps that schema in React Three Fiber for human editors — useful, but a level of abstraction the model doesn't need. Removing it leaves a clean data surface that Claude can reason about and a `.glb` output you visualize anywhere.

## Coordinate system

- Walls: `start` and `end` are `[x, z]` on the floor plan, in metres.
- Doors / windows: `position` is wall-local `[x, y, z]` where `y=0` is the floor.
- Roofs: positioned in level space with `[x, y, z]`; `y` should equal the wall height.
- glTF output is right-handed, Y-up.

## License

MIT — same as the upstream `pascalorg/editor`.
