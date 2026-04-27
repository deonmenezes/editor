# Onboarding

Three paths, depending on what you want to do.

---

## Path 1 — I just want to look around (60 seconds)

Open https://editor-six-indol.vercel.app

That's it. Drag to orbit, scroll to zoom. The status panel at the top-left shows whether the live relay is connected and how many other peers are in the room with you.

You're a *viewer* by default. To edit, see Path 2.

---

## Path 2 — I want to build (5 minutes)

### Prerequisites

- Claude Desktop or Claude Code (or any MCP-capable client)
- Node 18+
- Git, and either bun or npm

### Setup

```bash
git clone https://github.com/deonmenezes/editor.git
cd editor
bun install
bun run build
```

This produces the bundled MCP server at `packages/mcp/dist/index.js`.

### Wire it to Claude

In your Claude config — `~/.claude.json` for Claude Code, or
`%APPDATA%\Claude\claude_desktop_config.json` for Claude Desktop on Windows
(or `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "pascal": {
      "command": "node",
      "args": ["/absolute/path/to/editor/packages/mcp/dist/index.js"],
      "env": {
        "PASCAL_RELAY_URL": "wss://pascal-relay-deonmenezes.fly.dev",
        "PASCAL_ROOM": "pascal-shared-world"
      }
    }
  }
}
```

Important: use an absolute path. `~` doesn't expand in this JSON.

Restart Claude completely (Quit, not just close the window).

### First build

Open a new conversation and try:

> "Build me a small house, then add a window on the east wall and export it as a glb."

You should see Claude call `house_build`, then `window_add`, then `scene_export_glb`. While it works, refresh https://editor-six-indol.vercel.app — the house appears in the browser within a second.

### Drop in the agent skill (optional but recommended)

The repo ships a Claude skill at [`.claude/skills/pascal-build.md`](./.claude/skills/pascal-build.md) that teaches the model the coordinate system, the right way to compose walls into rooms, and patterns for common building requests.

If you're using Claude Code, it'll auto-load the skill from `.claude/skills/` in any project that has it. For Claude Desktop, copy the file into `~/.claude/skills/`.

### Build offline

If you don't want to share a world, leave `PASCAL_RELAY_URL` empty in the config. The plugin will work entirely locally — your edits live in a `scene.json` file next to the plugin and never leave your machine.

---

## Path 3 — I want to host my own world (20 minutes)

You'll deploy your own relay and your own website. The relay needs a host that supports persistent WebSockets (Vercel can't do this); Fly.io is what's already wired up.

### Fork & build

```bash
git clone https://github.com/deonmenezes/editor.git my-pascal-world
cd my-pascal-world
bun install
bun run build
```

### Deploy the relay (Fly.io)

```bash
# Install flyctl: https://fly.io/docs/hands-on/install-flyctl/
flyctl auth login

cd packages/relay
# Edit fly.toml: change "app = " to a name unique to you
flyctl apps create my-pascal-relay
flyctl deploy --remote-only --yes
```

Note the URL it prints — something like `https://my-pascal-relay.fly.dev`. The WebSocket URL is the same with `wss://`.

The fly.toml is configured for a single shared-cpu machine because y-websocket holds the world state in memory; multiple instances would each have their own copy. To go bigger, swap the relay for a Redis-backed setup or sticky-session routing.

### Deploy the website (Vercel)

```bash
cd ../..
vercel deploy --prod \
  --build-env NEXT_PUBLIC_PASCAL_RELAY_URL=wss://my-pascal-relay.fly.dev \
  --build-env NEXT_PUBLIC_PASCAL_ROOM=my-room-name
```

`--build-env` is important — these are `NEXT_PUBLIC_*` so they're baked at build time.

### Wire your plugin to your relay

In your Claude config, change `PASCAL_RELAY_URL` and `PASCAL_ROOM` to your own values. Restart Claude.

You're now hosting your own shared world. Anyone you give the website URL to can watch you build; anyone with both the relay URL + room name in their plugin config can edit.

---

## Troubleshooting

**Status panel stays "connecting…":** the relay is unreachable. Check the URL is `wss://` (not `ws://`) and that the host actually serves WebSockets. Try `curl https://your-relay/health` — should return `{"ok":true}`.

**Walls show up but in weird positions:** coordinate system is `[x, z]` for floor plan (z runs along the floor, not up). Y is up. Easy mistake.

**Two MCP peers' edits aren't merging:** if the relay is on multiple machines (Fly's `min_machines_running > 1`), each machine has a separate in-memory doc. Scale to 1 machine, or move state to Redis.

**Web build fails on Vercel with "next not found":** your repo root needs the install command to install the workspace. The repo's `vercel.json` already does this — make sure it's at the root, not under `packages/web`.

**`house_build` succeeds but the website still looks empty:** hard-refresh the page (the first connect bootstraps the doc; a stale Y.Doc cache can confuse it).

Anything else, open an issue: https://github.com/deonmenezes/editor/issues
