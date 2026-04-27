# AGENTS.md — orientation for any LLM dropped into this repo

You are looking at **Pascal** — a CRDT-backed shared 3D building world.
The original `pascalorg/editor` had a Next.js UI for humans; this fork
strips the UI and exposes the building schema as MCP tools so LLMs can
edit the world directly.

## What's where

```
packages/
├── core/      Zod schemas for nodes (wall, door, window, roof, slab, …)
│              No React, no three.js. Pure data shapes.
├── mcp/       Claude plugin. Stdio MCP server backed by a Y.Doc.
│              Each tool mutates the doc; mutations broadcast over
│              y-websocket to all connected peers.
├── relay/     Stateless y-websocket router. Holds zero app state —
│              just relays encrypted CRDT messages between peers.
└── web/       Next.js + R3F viewer. Joins the same Y.Doc as a peer
│              and renders the world in 3D. Static-export deployable
│              to Vercel.
tooling/
└── typescript/ shared tsconfigs
```

## Live infrastructure

- **Web**: https://www.jogabysa.com (Vercel)
- **Relay**: `wss://pascal-relay-deonmenezes.fly.dev` (Fly.io, single machine)
- **Default room**: `pascal-shared-world`

## Build commands

```bash
bun install          # workspace install
bun run build        # turbo build all packages
bun run --cwd packages/web dev   # local Next.js dev (port 3000)
node packages/relay/dist/index.js  # local relay (port 1234)
node packages/mcp/dist/index.js    # local MCP server, talks stdio
```

## Sync model

State is a Y.Doc with two top-level Y.Maps:

- `nodes`: every node in the world, keyed by node id
- `meta`: small metadata (currently `rootNodeIds`)

Rules:

- Nodes are stored as plain JSON values inside `Y.Map`. Updates
  *replace* a node entry, they don't merge field-by-field. Concurrent
  edits to the same node will conflict at last-write-wins level — fine
  for our usage; switch to nested Y types if/when granular merging
  matters.
- `BuildingNode.children` is `string[]` (level ids). `LevelNode.children`
  is `string[]` (node ids). **`SiteNode.children` holds *objects*, not
  ids** — quirk inherited from upstream. Traversal code must handle
  both shapes.

## Tool surface (packages/mcp/src/tools.ts)

`world_status`, `scene_summary`, `scene_clear`, `scene_save`,
`scene_load`, `wall_add`, `door_add`, `window_add`, `roof_add`,
`node_delete`, `house_build`, `scene_export_glb`.

Coordinate system: `[x, z]` for floor plan, Y up, metres. glTF export
is right-handed Y-up.

## When extending

- **New node type** → add Zod schema in `packages/core/src/schema/nodes/`,
  export from `schema/index.ts`, and (if it should render) add a case to
  `packages/web/components/world-meshes.tsx` and to
  `packages/mcp/src/glb.ts`.
- **New tool** → register it in `packages/mcp/src/tools.ts` with a
  JSONSchema `inputSchema` + handler. Mutate via `store.addNode` etc.,
  then `await store.saveToDisk()` for the offline-mode JSON copy.
- **Schema change to existing node** → bump the schema and add a
  migration in `scene-store.ts` if the doc on the wire could be old.
  Currently the only persistence is in-memory + JSON snapshot, so
  migrations are easier than they will be once IPFS snapshots are wired
  up.

## Don't

- **Don't reintroduce a UI dependency in `packages/core`.** Core stays
  framework-free Zod. R3F lives in `packages/web` only.
- **Don't bundle the relay's deps.** `packages/relay/Dockerfile`
  synthesizes its own clean `package.json` and runs `npm install` in
  the image — keep that pattern. Pulling the workspace's `package.json`
  into the image breaks because of `@pascal/typescript-config`.
- **Don't scale the Fly relay above 1 machine** without first moving
  state to Redis or enabling sticky sessions. y-websocket holds the
  Y.Doc in memory; multiple instances split the world.
- **Don't commit `scene.json` or `*.glb`.** They're in `.gitignore` for
  good reason — they're user runtime state.

## Open work

- **IPFS snapshot persistence** — survive relay restarts (see README)
- **WebRTC mesh** — drop the relay-as-bottleneck for browser peers
- **Moderator undo** — Y.js gives free history; UI piece is missing

## Skill for end-user agents

If you're an agent helping a user *use* the plugin (rather than work on
this codebase), the skill at `.claude/skills/pascal-build.md` tells you
how to use the tools well — coordinate system, common patterns, things
to avoid.
