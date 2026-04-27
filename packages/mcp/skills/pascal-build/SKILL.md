---
name: pascal-build
description: |
  Use this skill whenever the user asks to build, edit, design, or modify
  anything in a Pascal world — houses, buildings, rooms, walls, doors,
  windows, roofs, floor plans, architectural mock-ups. Triggered by phrases
  like "build a house", "add a wall", "design a cabin", "place a door",
  "show me what the world looks like". Also triggered when the user mentions
  the Pascal MCP plugin or the shared world at editor-six-indol.vercel.app.
---

# Pascal — agent guide

You have access to the Pascal MCP server. It edits a shared 3D building
world as a CRDT (Y.js). When you call a tool, the change syncs to every
other connected peer — including the live website at
https://www.jogabysa.com — within a second.

## Coordinate system (this trips people up)

- The floor plan is the **XZ plane**. Walls are described by `start` and
  `end`, each `[x, z]`. **Z is depth on the floor, not height.**
- **Y is up.** A wall's `height` is its vertical extent.
- Door / window `position` is `[x, y, z]` in **wall-local** coordinates:
  - `x = 0` is the centre of the wall
  - `y = 0` is the floor (so `y = height/2` puts a door's centre half-way up)
  - `z = 0` is on the wall plane; positive z is interior side
- Roof `position` is `[x, y, z]` in level space; set `y` equal to the wall
  height so the roof sits on top.

Units are metres throughout.

## Tools you have

| Tool | When to use |
|------|-------------|
| `scene_summary` | **Always call first** if the user references "the world", "what's there", "the current build" — gives you a text tree of every node and its dimensions. Cheap. Don't build blind. |
| `world_status` | If you suspect the relay isn't connected or want to confirm peer count |
| `house_build` | Best one-shot for "build me a house" — produces 4 walls + optional interior divider + door + windows + gable roof in one call. Tweak `width`, `depth`, `wallHeight`, `windowCount` |
| `wall_add` | Each wall = a line segment with thickness and height. Most builds compose multiple walls |
| `door_add` / `window_add` | Take a `wallId`. Position is wall-local. Defaults are sensible: door 0.9 × 2.1 m centred at floor; window 1.4 × 1.2 m centred ~1.5 m up |
| `roof_add` | One-segment roof. `roofType: 'gable'` for pitched, `'flat'` for flat, others available |
| `node_delete` | Pass `ids: [...]`. Cascades to descendants |
| `scene_clear` | **Destructive — confirm with user first.** Wipes the shared world for everyone |
| `scene_export_glb` | Snapshot to a `.glb` file the user can open in Blender |
| `scene_save` / `scene_load` | Local JSON snapshot. Useful for backups before risky edits |

## Patterns that work well

### Building a house from scratch

Almost always: `house_build` with reasonable params, then add detail with
`door_add` / `window_add`. Don't manually `wall_add` four times — that's
fragile and the helper is what it's for.

```
house_build({ width: 8, depth: 6, wallHeight: 2.7, windowCount: 3 })
→ 5 walls (incl. interior divider), 1 door, 3 windows, 1 gable roof
```

### Adding to an existing build

Always `scene_summary` first to see what walls exist and what their ids
are. Then add to specific walls by id.

```
scene_summary
# pick the wallId you want from the output
window_add({ wallId: "wall_xxx", position: [0, 1.5, 0], width: 1.2 })
```

### A two-room house

```
wall_add  start=[-4,-3] end=[4,-3]   name="South Wall"
wall_add  start=[-4, 3] end=[4, 3]   name="North Wall"
wall_add  start=[-4,-3] end=[-4,3]   name="West Wall"
wall_add  start=[4,-3]  end=[4, 3]   name="East Wall"
wall_add  start=[0,-3]  end=[0, 3]   name="Divider"   # splits the building in half
roof_add  roofType="gable" width=8.4 depth=6.4 wallTopY=2.7 roofHeight=1.8
```

Add doors / windows referencing the wall ids returned by each `wall_add`.

### Knowing where you are

If unsure, call `world_status` and `scene_summary`. The model needs to
*see* the current state before adding to it; building blind in a shared
world means colliding with other peers' walls.

## Best practices

1. **Read first, write second.** `scene_summary` before edits unless the
   user is explicitly starting fresh.
2. **Be conservative with `scene_clear`.** It deletes work for *everyone*
   in the room. Confirm with the user.
3. **Coordinate-system sanity check.** When you compute wall endpoints,
   double-check Z is depth, not height. A 4 m wall along X looks like
   `start=[-2, 0]`, `end=[2, 0]` — both Z values are equal because the
   wall doesn't run along Z.
4. **Wall ids are needed for openings.** Capture the `id` returned by
   `wall_add` (or grab it from `scene_summary`) before calling
   `door_add` / `window_add`.
5. **Don't spam tiny edits.** Each tool call has overhead. Batch into a
   single `house_build` or a small handful of `wall_add` calls when you
   can.
6. **Confirm exports.** After `scene_export_glb`, tell the user the path
   and what to do with it (Blender, VS Code's glTF preview, online viewer).

## When the relay is offline

If `world_status` shows `connected: false`, edits still apply locally
(stored in `scene.json`) and will sync once the relay comes back. Tell
the user the situation rather than failing silently.

## Things to never do

- Don't call `scene_clear` without explicit user instruction.
- Don't make up node ids — read them from `scene_summary` or capture
  them from tool responses.
- Don't try to render the world yourself — the website does that.
- Don't treat the room as private. Anything you build is visible to
  every connected peer.
