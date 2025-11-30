> **Coverage**: Redstone behavior, visual behavior (ex. redstone dust pattern), physical behavior (gravity), player interaction validation (ex. block placement).
>
> **Target**: Minecraft 1.21 Java Edition game-accurate engine.
>
> **Principles**:
> - Conciseness
> - Unambiguous — only one interpretation
> - Implementation independent
> - Complete — covers all scope mentioned
> - Accurate — faithful to 1.21

---

# Redstone Specification — Minecraft 1.21 Java Edition

## Overview

**Scope**: solid block, lever, button, pressure plate, piston, sticky piston, redstone dust, repeater, comparator, redstone torch, observer, slime block, redstone block. Infinite world.

**Coverage**: Redstone behavior, visual behavior, physical behavior, player interaction.

**Conventions**:
- Coordinates: (X, Y, Z) where Y is vertical (+Y = up)
- Directions: ±X, ±Y, ±Z (6 cardinal)
- SS = signal strength ∈ {0..15}
- gt = game tick = 0.05s
- rt = redstone tick = 2 gt = 0.1s

---

## Definitions

### D1: Adjacent
Two positions are **adjacent** iff they differ by exactly 1 in exactly one coordinate. Position (x,y,z) has 6 adjacent positions: (x±1,y,z), (x,y±1,z), (x,y,z±1). Diagonal positions are NOT adjacent.

### D2: Block Properties

**Full block**: 1×1×1 dimensions with full-cube collision.

**Conductive block**: Can be powered by redstone components and transmit power. Most full opaque blocks are conductive.

**Non-conductive blocks in scope**: piston, sticky piston, observer, redstone block. These CANNOT be powered.

**Conductive blocks in scope**: solid block, slime block (despite visual transparency).

**Gravity**: None of the 13 blocks in scope are gravity-affected. All remain stationary when unsupported.

### D3: Power States (Conductive Blocks Only)

| State | Condition | Powers Adjacent Dust? |
|-------|-----------|----------------------|
| Unpowered | No power received | No |
| Weakly-powered | Powered ONLY by dust on top or pointing at it | No |
| Strongly-powered | Powered by lever, button, pressure plate, repeater front, comparator front, torch below, observer back | Yes (SS=15) |

Both weakly and strongly-powered blocks activate adjacent mechanisms and power repeaters/comparators.

### D4: Movability

| Class | Behavior | Blocks |
|-------|----------|--------|
| NORMAL | Pushed and pulled | solid block, slime block, redstone block, observer, retracted piston/sticky piston |
| DESTROY | Drops as item | dust, lever, button, pressure plate, torch |
| IMMOVABLE | Piston fails | extended piston, piston head, repeater, comparator |

Note: Glazed terracotta (not in scope) is pushable but not pullable and does not stick to slime blocks.

### D5: Entity
- **Player**: user-controlled
- **Mob**: living creature (includes armor stand)
- **Item**: dropped stack (1 stack = 1 entity)
- **Projectile**: arrow, trident, snowball, egg, wind charge, etc.

### D6: Block State

| Block | Properties |
|-------|------------|
| Solid block | (identity only) |
| Lever | facing, face, powered |
| Button | facing, face, powered |
| Pressure plate | powered |
| Dust | power ∈ {0..15}, north/south/east/west ∈ {none,side,up} |
| Repeater | facing, delay ∈ {1,2,3,4}, locked, powered |
| Comparator | facing, mode ∈ {compare,subtract}, powered |
| Torch | facing, lit |
| Piston | facing, extended |
| Sticky piston | facing, extended |
| Observer | facing, powered |
| Slime block | (none) |
| Redstone block | (none) |

**D6a: State Change**: Any property transition or block identity change (including air↔block).

### D7: Dust Orientation
For dust at P, direction D ∈ {+X,-X,+Z,-Z}:

**Connects when:**
1. P+D contains: dust, lever, torch, redstone block
2. P+D contains repeater/comparator with back or front facing P
3. P+D+Y contains dust AND P+D is not conductive
4. P+D-Y contains dust AND P+Y is not conductive

**Does NOT connect to:** button, pressure plate, piston, observer, repeater/comparator sides

**Shape:**
- 0 connections: cross or dot (player-toggleable)
- 1 connection: line through center both ways
- 2+ connections: exact directions only

---

## Solid Block

**Physical**: 1×1×1. Full collision. NORMAL movability. Not gravity-affected.

**Visual**: Opaque cube.

**Placement**: Any position with valid support or adjacent block.

**Redstone**: Conductive per D3.

---

## Lever

**Physical**: Attaches to top/side/bottom of full opaque block; top of upside-down slab/stairs. No collision. DESTROY.

**Visual**: Base with handle. Floor/ceiling: tilts toward placement (off) / away (on). Wall: down (off) / up (on).

**Interaction**: Right-click toggles instantly.

**Redstone** (on): SS=15 to all 6 adjacent. Strongly powers attachment block (if conductive). Activates adjacent mechanisms.

---

## Button

**Physical**: Attaches to top/side/bottom of full opaque block. Height 1/16 (inactive), 1/32 (active). No collision. DESTROY.

**Visual**: Raised (inactive), depressed (active).

**Interaction**:
- Right-click activates
- Wood: arrow/trident activates until despawn (60s) or pickup
- Stone: arrows/tridents do NOT activate; wind charges DO activate

**Timing**:

| Type | Duration |
|------|----------|
| Stone | 20 gt (1.0s) |
| Wood | 30 gt (1.5s) |

**Redstone** (active): SS=15 to all 6 adjacent. Strongly powers attachment block (if conductive).

---

## Pressure Plate

**Physical**: On top of full opaque block, fence, upside-down slab/stairs, hopper. Height 1/16 (inactive), 1/32 (active). No collision. DESTROY.

**Visual**: Flat rectangle.

**Detection volume**: (X, Y, Z) to (X+1, Y+0.25, Z+1)

| Type | Detects | Output |
|------|---------|--------|
| Wood | All entities except snowball | SS=15 |
| Stone | Player, mob, armor stand | SS=15 |
| Light weighted (gold) | All entities except snowball | min(entity_count, 15) |
| Heavy weighted (iron) | All entities except snowball | min(⌈entity_count/10⌉, 15) |

**Timing**:
- Wood/Stone: Check every 20 gt. Deactivate at next 20 gt multiple after entity leaves, minimum 20 gt total.
- Weighted: Deactivate 10 gt after entity leaves. Always active for multiples of 10 gt, minimum 10 gt.

**Redstone**: Output SS to adjacent. Strongly powers support block (if conductive).

---

## Redstone Dust

**Physical**: On top of conductive block, glowstone, upside-down slab/stairs, glass, hopper. No collision. DESTROY.

**Visual**: Dark red (SS=0) to bright red (SS=15). Shape per D7.

**Interaction**: Right-click toggles cross↔dot when 0 connections.

**Receives** (maximum of):
- Adjacent on-lever: 15
- Adjacent active button: 15
- Adjacent active pressure plate: its SS
- Adjacent strongly-powered block: 15
- Adjacent repeater/comparator/observer outputting toward: their SS
- Adjacent lit torch: 15
- Adjacent redstone block: 15
- Connected dust: source.SS - 1

**Propagation**: Instant.

**Outputs** (SS ≥ 1):
- Weakly powers: conductive block beneath; conductive block it points toward
- Activates: mechanism beneath; mechanism it points toward
- Powers: repeater/comparator at back
- Dot: only block beneath

---

## Repeater

**Physical**: On top of conductive block, slime block, upside-down slab/stairs. Height 2/16. No collision. IMMOVABLE.

**Visual**: Slab with arrow. Two torches indicate delay. Gray bar when locked.

**Interaction**: Right-click cycles delay 1→2→3→4→1.

**Delay**:

| Setting | Delay |
|---------|-------|
| 1 | 2 gt |
| 2 | 4 gt |
| 3 | 6 gt |
| 4 | 8 gt |

**Input** (back): Powered by dust (SS≥1), powered conductive block, repeater/comparator/observer output, lever, button, pressure plate, torch, redstone block.

**Output** (front, when powered and unlocked):
- SS=15 always
- Strongly powers conductive block
- Powers dust/repeater/comparator
- Activates mechanisms (not via piston front)

**Pulse extension**: Pulses shorter than delay extended to match delay.

**Locking**: Powered repeater or comparator facing side → output frozen.

---

## Comparator

**Physical**: On top of conductive block, slime block, upside-down slab/stairs. Height 2/16. No collision. IMMOVABLE.

**Visual**: Slab with arrow. Three torches. Front torch lit = subtract mode.

**Interaction**: Right-click toggles compare↔subtract.

**Delay**: 2 gt. Does NOT respond to 1 gt pulses; may respond to 2 gt pulses in specific configurations.

**Rear input R**: Maximum from dust, powered conductive block, repeater/comparator/observer output, lever, button, pressure plate, torch, redstone block.

**Side input S**: max(left, right). Each accepts ONLY: dust, redstone block (Java Edition), repeater/comparator/observer output facing in.

**Output**:

| Mode | Formula |
|------|---------|
| Compare | R ≥ S ? R : 0 |
| Subtract | max(0, R - S) |

**Output behavior**: Strongly powers front conductive block. Powers dust/repeater/comparator. Activates mechanisms (not via piston front).

---

## Redstone Torch

**Physical**: Attaches to top/side of conductive block; top of fence, glass, upside-down slab/stairs, cobblestone wall. NOT bottom. No collision. DESTROY.

**Visual**: Stick with tip. Lit: red glow, light level 7. Unlit: dark.

**Delay**: 2 gt.

**Input**: Powered attachment block (weak OR strong) → OFF. Otherwise → ON. Non-conductive attachment blocks cannot be powered, so torch stays on.

**Output** (lit):
- SS=15 to all 6 adjacent EXCEPT attachment block
- Strongly powers conductive block at Y+1
- Activates adjacent mechanisms
- Powers repeater/comparator at back

**Burnout**: ≥8 state changes in 60 gt → off, smoke, ignores input until <8 changes in trailing 60 gt, then re-evaluates on update.

---

## Piston / Sticky Piston

**Physical**: Facing any direction. Retracted: 1×1×1, NORMAL. Extended: 2 blocks, IMMOVABLE. Not gravity-affected.

**Visual**: Stone base, wood front (piston) or green slime front (sticky). Animation: 2 gt.

**Conductivity**: NON-CONDUCTIVE. Cannot be powered; can only be activated.

**Placement**: Any position. Faces toward player when placed.

**Push limit**: 12 blocks.

**Extension**: Pushes up to 12 blocks. DESTROY blocks drop. NORMAL blocks pushed. Fails if >12, IMMOVABLE in path, or world boundary.

**Retraction**: Piston retracts head only. Sticky piston pulls NORMAL block at head.

**Activation** (any face EXCEPT front):
- Adjacent lever/button/pressure plate (on/active)
- Adjacent powered conductive block (weak or strong)
- Adjacent lit torch, redstone block
- Dust (SS≥1) pointing at or on top
- Repeater/comparator/observer outputting in
- **Quasi-connectivity**: Above conditions at (piston.Y+1); requires block update

**Timing**:
- Start delay: 0-1 gt (game phase dependent)
- Extension: 2 gt
- Retraction: 2 gt

**Short pulse** (<3 gt): Finishes extending early, starts retracting. Sticky piston "drops" block.

---

## Observer

**Physical**: 1×1×1. Full collision. NORMAL. Not gravity-affected.

**Visual**: Stone with face (front), red dot (back). Dot lights during pulse.

**Conductivity**: NON-CONDUCTIVE. Cannot be powered.

**Placement**: Any position. Faces toward player when placed.

**Detects** (at front): Block state change (D6a) including:
- Block placed/removed/changed
- Property changes (dust power, lever/button/plate powered, repeater delay/locked/powered, comparator mode/powered, torch lit, piston extended, observer powered)
- Observer moved by piston (triggers after move)

**Output**:
- Delay: 2 gt
- Pulse: 2 gt
- SS=15 from back
- Strongly powers back conductive block
- Powers dust/repeater/comparator at back
- Activates mechanisms at back (not via piston front)

---

## Slime Block

**Physical**: 1×1×1. Full collision. NORMAL with stickiness. Not gravity-affected.

**Stickiness**: Adjacent NORMAL blocks move together when piston moves this. Recursive. Total ≤12. Does NOT stick to: glazed terracotta, honey blocks.

**Visual**: Translucent green cube.

**Conductivity**: CONDUCTIVE (despite transparency). Can be powered per D3.

**Placement**: Any position.

**Entity physics**:
- Friction: 0.8 (normal=0.6, ice=0.98)
- Landing: bounce (velocity inverted), no fall damage
- Jump held: no bounce, no damage
- Sneak held: no bounce, takes damage (1.21.0–1.21.1); no damage (1.21.2+)
- Items/minecarts/boats/falling blocks: do NOT bounce

---

## Redstone Block

**Physical**: 1×1×1. Full collision. NORMAL. Not gravity-affected.

**Visual**: Red cube with circuit pattern.

**Conductivity**: NON-CONDUCTIVE. Cannot be powered.

**Placement**: Any position.

**Redstone**: Permanently active.

**Output**:
- Powers adjacent dust to SS=15
- Powers repeater/comparator at back
- Activates adjacent mechanisms (not via piston front)
- Side input SS=15 to adjacent comparators
- Does NOT power conductive blocks

**Torch interaction**: Attached torch turns off after 2 gt, stays off while redstone block present.

---

## Block Update Propagation

**Trigger**: State change at P.

**Recipients**: All blocks within taxicab distance ≤2 from P receive updates. This includes:
- 6 blocks adjacent to P (distance 1)
- 12 blocks at distance 2

**Quasi-connectivity note**: Pistons/dispensers/droppers check activation conditions at Y+1, but updates only propagate distance 2. This mismatch causes BUD (Block Update Detector) behavior where components are "powered" but not "updated."

**Response**:

| Component | Action |
|-----------|--------|
| Dust | Recalculates SS |
| Repeater/Comparator | Re-evaluates, schedules change |
| Torch | Re-evaluates attachment block power |
| Piston | Re-evaluates activation (including Y+1) |
| Observer | No response (detects at front only) |

---

## Timing Reference

| Component | Delay | Duration |
|-----------|-------|----------|
| Lever | 0 | toggle |
| Stone button | 0 | 20 gt |
| Wood button | 0 | 30 gt |
| Stone/wood plate | 0 | ≥20 gt |
| Weighted plate | 0 | ≥10 gt |
| Dust | 0 | — |
| Repeater | 2/4/6/8 gt | — |
| Comparator | 2 gt | — |
| Torch | 2 gt | — |
| Observer | 2 gt | 2 gt |
| Piston | 0-1 gt | 2 gt |
| Burnout | — | ≥8/60 gt |

---
