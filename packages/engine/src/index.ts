export const SPEC = `# Redstone Specification — Minecraft 1.21 Java Edition

**Scope**: solid block, lever, button, pressure plate, piston, sticky piston, redstone dust, repeater, comparator, redstone torch, observer, slime block, redstone block. Infinite world.

---

## Solid Block

**Physical**: 1×1×1. Full collision. Pushable.

**Visual**: Opaque cube.

**Redstone**: Power state ∈ {unpowered, weakly-powered, strongly-powered}. Only strongly-powered blocks provide SS=15 to adjacent dust.

---

## Lever

**Physical**: Occupies cell adjacent to attachment face. Attaches to any face of solid block or piston/sticky piston base. Cannot be pushed (drops if piston attempts). Drops if attachment block removed.

**Visual**: Handle orientation determined by attached face and placement direction. On state: handle opposite of off state. Emits particles when on.

**Interaction**: Right-click toggles on↔off.

**Redstone** (when on):
- Emits SS=15 to all 6 adjacent positions
- Strongly powers attachment block (if solid block)

---

## Button

**Physical**: Attaches to any face of solid block. No collision. Cannot be pushed (drops if piston attempts). Drops if attachment block removed.

**Visual**: Small raised rectangle on attachment face. Pressed state: recessed. Placement on top/bottom: faces player's horizontal direction.

**Interaction**: Right-click activates. Wood button also activated by arrow/trident (remains active until projectile despawns or retrieved).

**Redstone**: Pulse duration: stone = 10 redstone ticks (20 gt); wood = 15 redstone ticks (30 gt).

*Output* (when active):
- Emits SS=15 to all 6 adjacent positions
- Strongly powers attachment block (if solid block)
- Activates adjacent pistons

---

## Pressure Plate

**Physical**: Placed on top face of: solid block, hopper, fence, upside-down slab, upside-down stairs. Height 1/16 block (inactive) / 1/32 block (active). No collision. Cannot be pushed (drops if piston attempts). Drops if support removed.

**Visual**: Flat rectangle. Variants: wood (plank texture), stone (stone texture), light weighted (gold), heavy weighted (iron). Depresses slightly when active.

**Interaction**: Activated when entity's collision box intersects bottom 0.25 blocks of plate's space.

**Redstone**: Variants differ in detection and output:

| Variant | Detects | Output SS |
|---------|---------|-----------|
| Wood | All entities (players, mobs, items, arrows) | 15 |
| Stone | Players and mobs only | 15 |
| Light weighted (gold) | All entities | min(entity count, 15) |
| Heavy weighted (iron) | All entities | min(ceil(entity count ÷ 10), 15) |

*Note*: Item stack = 1 entity regardless of stack size.

*Output* (when active):
- Strongly powers block beneath
- Powers adjacent dust to output SS
- Powers repeaters/comparators facing away to output SS
- Activates adjacent mechanism components (including above/below)

*Timing*: Deactivation check every 10 redstone ticks (20 gt) after activation. Deactivates when no entities present at next check.

---

## Dust

**Physical**: Placed on top face of: solid block, slime block, retracted piston/sticky piston, extended piston/sticky piston base, observer. No collision. Cannot be pushed (drops if piston attempts). Drops if support removed.

**Visual**: SS=0 dark red → SS=15 bright red. Particles when SS≥1. Shape determined by connections:
- Connects to: adjacent dust, dust at Y±1 (blocked if solid block directly above lower dust; observer blocks downward but not upward), lever, repeater back, repeater front, comparator back, comparator front, redstone torch, observer back
- Does NOT auto-connect to: piston, repeater sides, comparator sides, observer front/sides
- No connections: + shape (configurable to dot via right-click)

**Redstone**: SS ∈ {0..15}.

*Receiving*: SS = max of: adjacent on-lever/button/pressure plate → their SS; adjacent strongly-powered block → 15; adjacent repeater output (front) → 15; adjacent comparator output (front) → its SS; adjacent lit torch → 15; adjacent observer output (back) → 15; adjacent redstone block → 15; each connected dust → (their SS − 1).

*Providing* (when SS≥1):
- Weakly powers: solid block or slime block beneath (not observer); solid blocks or slime blocks pointed toward
- Activates: piston pointed toward; piston beneath
- Powers repeater/comparator: if pointed toward or adjacent to back
- Dot shape: only powers/activates block beneath

---

## Repeater

**Physical**: Placed on top face of solid block or slime block. Height 1/8 block. No collision. Cannot be pushed (drops if piston attempts). Drops if support removed.

**Visual**: Flat slab with arrow pointing toward front (output). Two torches on top:
- Torch color: dark red (off) / bright red (on)
- Torch spacing indicates delay setting (closer = shorter delay)
- When locked: bar rendered across movable torch

**Interaction**: Right-click cycles delay: 2→4→6→8→2 gt.

**Redstone**: Facing ∈ {±X, ±Z}. Delay ∈ {2, 4, 6, 8} gt (default 2).

*Input* (back face only): Powered when any of:
- Dust pointing at or adjacent to back
- Powered block (strongly or weakly) at back
- Another repeater outputting into back
- Comparator outputting into back
- On-lever, active button, or active pressure plate adjacent to back
- Lit torch adjacent to back
- Observer outputting into back
- Redstone block adjacent to back

*Output* (front face only, when powered and not locked):
- Emits SS=15 to front position
- Strongly powers solid block or slime block at front
- Activates piston at front (except piston's front face)
- Powers dust at front
- Powers repeater/comparator at front

*Locking*: Locked when powered repeater outputs directly into either side (perpendicular to facing). While locked: output state frozen regardless of input. Unlocks when locking repeater turns off.

*Timing*:
- Output changes after configured delay from input change
- Pulse extension: if input pulse < delay, output pulse extended to match delay
- Off-pulses shorter than delay are suppressed

---

## Comparator

**Physical**: Placed on top face of solid block or slime block. Height 1/8 block. No collision. Cannot be pushed (drops if piston attempts). Drops if support removed.

**Visual**: Flat slab with arrow pointing toward front (output). Three torches on top: two at back, one at front.
- Back torches: lit when rear input active
- Front torch: off = comparison mode (default); on = subtraction mode
- When outputting: front torch bright

**Interaction**: Right-click toggles mode: comparison ↔ subtraction.

**Redstone**: Facing ∈ {±X, ±Z}. Delay: 2 gt (1 redstone tick). Does not respond to 1-tick pulses.

*Input*:
- Rear: from dust, powered block, repeater, comparator, torch, observer, redstone block, or readable block
- Sides: ONLY from dust, redstone block, repeater, comparator, or observer outputting directly into side

*Output* (from front):
- Comparison mode: outputs rear SS if rear ≥ max(left, right); else 0
- Subtraction mode: outputs max(0, rear − max(left, right))
- Strongly powers solid block or slime block at front
- Powers dust at front
- Powers repeater/comparator at front
- Activates piston at front (except piston's front face)

---

## Redstone Torch

**Physical**: Attaches to top or side face of solid block or slime block; top face of piston/sticky piston. Not bottom of any block. No collision. Cannot be pushed (drops if piston attempts). Drops if attachment block removed or moved.

**Visual**: Stick with colored tip. Lit: bright red glow. Unlit: dark red. Emits light level 7 when lit.

**Redstone**: State ∈ {lit, unlit}. Delay: 2 gt (1 redstone tick) to change state.

*Input*: Turns off when attachment block is strongly powered. Turns on when attachment block is no longer strongly powered.

*Output* (when lit):
- Emits SS=15 to all adjacent positions EXCEPT attached block
- Strongly powers solid block or slime block directly above
- Weakly powers adjacent solid blocks and slime blocks (not above, not attached)
- Activates adjacent pistons (including above/below)
- Powers repeater/comparator if adjacent to back

*Burnout*: If state changes >8 times within 60 gt (3 seconds):
- Torch turns off (emits smoke particles)
- Ignores state change attempts until changes in last 60 gt < 8
- Re-activates upon receiving block update after cooldown

---

## Piston / Sticky Piston

**Physical**: Facing ∈ {±X, ±Y, ±Z}.
- Retracted: 1×1×1. Full collision. Pushable.
- Extended: base (1×1×1) + head at (base + facing). Both full collision. Immovable.
- Extension: pushes up to 12 blocks 1 cell in facing direction. Destroys dust/lever/button/pressure plate/repeater/comparator/torch in path (drop as items). Fails if >12 blocks or extended piston/immovable block in path.
- Retraction (sticky only): pulls 1 block adjacent to head. Fails silently if block is immovable or absent.

**Visual**: Body stone-textured. Head: wood-textured (regular) / green slime-textured (sticky). Extension/retraction animates over 2 gt.

**Redstone**: Activated by (never from front face):
- Adjacent on-lever, active button, or active pressure plate
- Adjacent powered block (strongly or weakly)
- Adjacent lit torch
- Adjacent redstone block
- Dust pointing at or atop piston (SS≥1)
- Repeater outputting into piston (not front face)
- Comparator outputting into piston (not front face)
- Observer outputting into piston (not front face)
- Quasi-connectivity: any above condition satisfied at (piston.X, piston.Y+1, piston.Z); requires block update

*Timing*: Extension begins 0–1 gt after activation (phase-dependent), completes in 2 gt. Retraction: same.

*Short pulse* (<3 gt): Piston aborts extension early, instantly returning to retracted state with pushed blocks at destination. Sticky piston "drops" block (does not pull back).

---

## Observer

**Physical**: 1×1×1. Full collision. Pushable. Facing ∈ {±X, ±Y, ±Z}. Placed like piston: face points toward block placed against (away from player).

**Visual**: Stone block with face texture on front (observing side), small red dot on back (output side). Output dot lights briefly when emitting pulse.

**Redstone**: Non-conductive (cannot be powered; does not transmit power through itself).

*Trigger*: Detects block state change at position directly in front of face. State changes include: block placed/removed, block property changed (dust SS, repeater delay, lever state, piston extension, etc.). Also triggers once after being moved by piston.

*Output*: Emits 2 gt pulse at SS=15 from back face after 2 gt delay:
- Strongly powers solid block or slime block at back
- Activates piston at back (not piston's front face)
- Powers dust at back
- Powers repeater/comparator at back

---

## Slime Block

**Physical**: 1×1×1. Full collision. Pushable. Sticky: when moved by piston, attempts to move all adjacent (not diagonal) movable blocks; moved blocks can push further blocks (e.g., 2×2×2 cube moves as unit). 12-block piston limit still applies to total. Does NOT stick to: honey blocks, glazed terracotta (neither in scope). Stickiness is unilateral: if adjacent non-slime block is pushed by separate piston, slime block does not follow. If adjacent movable block is obstructed by immovable block, slime block also cannot move.

**Visual**: Translucent green cube.

**Redstone**: Conductive (can be weakly/strongly powered; affects attached torches). No output behavior.

---

## Redstone Block

**Physical**: 1×1×1. Full collision. Pushable.

**Visual**: Red cube with circuit-like texture.

**Redstone**: Always on (cannot be deactivated). Outputs SS=15.

*Output*:
- Powers adjacent dust (all 6 sides) to SS=15
- Powers repeaters/comparators facing away to SS=15
- Activates adjacent pistons (except piston's front face)
- Provides side input to adjacent comparators (as if dust SS=15)
- Does NOT power adjacent solid blocks

*Note*: Torch attached to redstone block turns off after 2 gt (normal torch delay on powered block).

---

## Block Update

**Trigger**: Block placed, removed, or state changed → updates all 6 adjacent positions.

**Response**:
- Dust: recalculates SS
- Repeater: re-evaluates input; schedules output change if needed
- Comparator: re-evaluates inputs; schedules output change if needed
- Torch: re-evaluates input; schedules state change if needed
- Piston: re-evaluates activation
- Observer: (responds to state change in observed block, not block updates)
- Lever/button/pressure plate/dust/repeater/comparator/torch: drops if support invalid`

import type { Solid } from "./blocks/solid.js"
import type { Lever } from "./blocks/lever.js"
import type { Dust } from "./blocks/dust.js"
import type { Piston } from "./blocks/piston.js"
import type { StickyPiston } from "./blocks/sticky-piston.js"
import type { Repeater } from "./blocks/repeater.js"
import type { Torch } from "./blocks/torch.js"
import type { Observer } from "./blocks/observer.js"
import type { Button } from "./blocks/button.js"
import type { Slime } from "./blocks/slime.js"
import type { RedstoneBlock } from "./blocks/redstone-block.js"
import type { PressurePlate } from "./blocks/pressure-plate.js"
import type { Comparator } from "./blocks/comparator.js"

export { Engine, type EventHandler } from "./engine.js"
export { type EngineEvent } from "./events.js"
export {
  type Snapshot,
  type BlockState,
  encodeSnapshot,
  decodeSnapshot,
  snapshotToUrl,
  snapshotFromUrl
} from "./snapshot.js"
export { Solid, type PowerState } from "./blocks/solid.js"
export { Lever } from "./blocks/lever.js"
export { Dust, type DustShape } from "./blocks/dust.js"
export { Piston } from "./blocks/piston.js"
export { StickyPiston } from "./blocks/sticky-piston.js"
export { Repeater } from "./blocks/repeater.js"
export { Torch } from "./blocks/torch.js"
export { Observer } from "./blocks/observer.js"
export { Button } from "./blocks/button.js"
export { Slime } from "./blocks/slime.js"
export { RedstoneBlock } from "./blocks/redstone-block.js"
export { PressurePlate, type PressurePlateVariant } from "./blocks/pressure-plate.js"
export { Comparator, type ComparatorMode } from "./blocks/comparator.js"

export { Vec, X, Y, Z, HORIZONTALS, ALL_DIRECTIONS, type VecObj } from "./vec.js"
export { PowerGraph, type PowerNode, type PowerEdge, type PowerEdgeType } from "./power-graph.js"
export { renderSlice, blockSymbol, blockDetails, type SliceAxis } from "./slice.js"
export {
  buildContraption,
  B,
  type Direction,
  type BlockDef,
  type Cell,
  type Slice,
  type Contraption,
  type BuildResult,
} from "./builder.js"

export type Block =
  | Solid
  | Lever
  | Dust
  | Piston
  | StickyPiston
  | Repeater
  | Torch
  | Observer
  | Button
  | Slime
  | RedstoneBlock
  | PressurePlate
  | Comparator
