# Redstone Specification — Minecraft 1.21 Java Edition

**Scope**: solid block, lever, button, pressure plate, piston, sticky piston, redstone dust, repeater, comparator, redstone torch, observer, slime block, redstone block. Infinite world.

**Conventions**: 
- Coordinates: (X, Y, Z) where Y is vertical (up = +Y)
- Directions: ±X, ±Y, ±Z (6 cardinal directions)
- SS = signal strength ∈ {0..15}
- gt = game tick (1/20 second = 0.05s)
- rt = redstone tick = 2 gt (0.1s)

---

## Definitions

### D1: Adjacent
Two blocks are **adjacent** if and only if they share exactly one face. A block at (x,y,z) has exactly 6 adjacent positions: (x-1,y,z), (x+1,y,z), (x,y-1,z), (x,y+1,z), (x,y,z-1), (x,y,z+1). Diagonal positions (differing in 2+ coordinates) are NOT adjacent.

### D2: Solid Block (in scope)
A **solid block** is any opaque, full-cube block with standard collision. Properties:
- Dimensions: exactly 1×1×1 blocks
- Collision: full cube (entity bounding boxes cannot intersect interior)
- Opacity: fully opaque (light level 0 transmitted through)
- Conductivity: can hold power state (unpowered, weakly-powered, or strongly-powered)

### D3: Power States
Solid blocks and slime blocks have exactly one power state at any time:
- **Unpowered**: receiving no power from any source
- **Weakly-powered**: powered ONLY by redstone dust on top or pointing at it
- **Strongly-powered**: powered by any source listed below:
  - Lever (on) attached to block
  - Button (active) attached to block
  - Pressure plate (active) on top of block
  - Repeater (powered) with front face touching block
  - Comparator (output > 0) with front face touching block
  - Redstone torch (lit) directly below block (at Y-1)
  - Observer (pulsing) with back face touching block

A strongly-powered block provides SS=15 to adjacent dust. A weakly-powered block does NOT power adjacent dust, but does power adjacent repeaters/comparators and activates adjacent mechanism components.

### D4: Movability Classes
Every block belongs to exactly one movability class:

| Class | Piston Behavior | Blocks (in scope) |
|-------|-----------------|-------------------|
| NORMAL | Pushed and pulled | solid block, slime block, redstone block, observer, retracted piston, retracted sticky piston |
| DESTROY | Drops as item when pushed | dust, lever, button, pressure plate, repeater, comparator, torch |
| IMMOVABLE | Piston fails to extend | extended piston, extended sticky piston, piston head |
| PUSH_ONLY | Pushed but not pulled | (none in scope) |

### D5: Entity
An **entity** is any dynamic game object that is not a block:
- **Player**: user-controlled character
- **Mob**: any living creature (animals, monsters, villagers, etc.)
- **Item**: dropped item stack (1 stack = 1 entity regardless of item count)
- **Projectile**: arrow, trident, snowball, egg, etc.
- **Armor stand**: decorative entity (counts as mob for pressure plate detection)

### D6: Block State
A **block state** is the complete set of properties defining a block's configuration:

| Block | State Properties |
|-------|------------------|
| Solid block | (none — identity only) |
| Lever | facing ∈ {N,S,E,W}, face ∈ {floor,wall,ceiling}, powered ∈ {true,false} |
| Button | facing ∈ {N,S,E,W,up,down}, face ∈ {floor,wall,ceiling}, powered ∈ {true,false} |
| Pressure plate | powered ∈ {true,false} |
| Dust | power ∈ {0..15}, north/south/east/west ∈ {none,side,up} |
| Repeater | facing ∈ {N,S,E,W}, delay ∈ {1,2,3,4}, locked ∈ {true,false}, powered ∈ {true,false} |
| Comparator | facing ∈ {N,S,E,W}, mode ∈ {compare,subtract}, powered ∈ {true,false} |
| Torch | facing ∈ {N,S,E,W,up}, lit ∈ {true,false} |
| Piston | facing ∈ {N,S,E,W,up,down}, extended ∈ {true,false} |
| Sticky piston | facing ∈ {N,S,E,W,up,down}, extended ∈ {true,false} |
| Observer | facing ∈ {N,S,E,W,up,down}, powered ∈ {true,false} |
| Slime block | (none) |
| Redstone block | (none) |

**D6a: State Change**: Occurs when (a) any property transitions to a different value, OR (b) block identity changes (including air↔block).

### D7: Dust Orientation
Dust shape determined by connections in 4 horizontal directions. Let P = dust position, D ∈ {+X, -X, +Z, -Z}:

**Connection rules** (evaluated independently per direction):
1. Block at (P+D) contains {dust, lever, redstone block} → connects in D
2. Block at (P+D) contains repeater/comparator with back facing toward P → connects in D
3. Block at (P+D) contains repeater/comparator with front facing toward P → connects in D
4. Block at (P+D) contains redstone torch → connects in D
5. Block at (P+D+UP) contains dust AND block at (P+D) is NOT {solid block, slime block} → connects in D
6. Block at (P+D-UP) contains dust AND block at (P+UP) is NOT {solid block, slime block} → connects in D

**Non-connections**: button, pressure plate, piston (all faces), observer (all faces), repeater sides, comparator sides, solid block (except via rules 5/6), slime block (except via rules 5/6)

**Shape**:
- 0 connections: cross (+) or dot (player-toggled)
- 1 connection: line through center extending both directions
- 2+ connections: connects exactly those directions

**D7a: Pointing**: Dust points toward D iff shape visually extends in D. Cross points all 4 horizontal. Dot points nowhere.

---

## Solid Block

**Physical**: 1×1×1. Full collision. Movability: NORMAL.

**Visual**: Opaque cube (texture varies by type).

**Redstone**: Power state per D3. Strongly-powered → provides SS=15 to adjacent dust.

---

## Lever

**Physical**: Attaches to face of {solid block, piston base}. Own block space. No collision. Movability: DESTROY.

**Visual**: Base plate with handle.
- Floor/ceiling: tilts toward placement direction (off) / away (on)
- Wall: points down (off) / up (on)

**Interaction**: Right-click toggles off↔on instantly.

**Redstone** (when on): Emits SS=15 to all 6 adjacent. Strongly powers attachment block.

**State**: facing, face, powered

---

## Button

**Physical**: Attaches to face of solid block. Own block space. No collision. Movability: DESTROY.

**Visual**: Raised 1/16 block (inactive), depressed 1/32 block (active).

**Interaction**: 
- Right-click activates
- Wood: arrow/trident collision activates (until despawn at 60s or pickup)
- Stone: projectiles do NOT activate

**Redstone**:
- Stone duration: 10 rt (20 gt = 1.0s)
- Wood duration: 15 rt (30 gt = 1.5s)
- When active: SS=15 to all 6 adjacent; strongly powers attachment block

**State**: facing, face, powered

---

## Pressure Plate

**Physical**: On top of {solid block, fence, upside-down slab/stairs}. Height 1/16 block (inactive), 1/32 (active). No collision. Movability: DESTROY.

**Visual**: Flat rectangle. Wood/stone/gold/iron textures by variant.

**Activation**: Entity bounding box intersects (plate.X, plate.Y, plate.Z) to (plate.X+1, plate.Y+0.25, plate.Z+1).

**Detection**:

| Variant | Detects | Output SS |
|---------|---------|-----------|
| Wood | player, mob, armor stand, item, projectile (not snowball) | 15 |
| Stone | player, mob, armor stand | 15 |
| Light weighted (gold) | player, mob, armor stand, item, projectile (not snowball) | min(entity_count, 15) |
| Heavy weighted (iron) | player, mob, armor stand, item, projectile (not snowball) | min(⌈entity_count ÷ 10⌉, 15) |

**Redstone**: Strongly powers support block. Emits output SS to adjacent.

**Timing**:
- Stone/wood: checks every 20 gt starting 20 gt after activation; deactivates up to 20 gt after last entity
- Weighted: deactivates 10 gt (5 rt) after last entity leaves

**State**: powered

---

## Dust

**Physical**: On top of {solid block, glowstone, upside-down slab/stairs, hopper, observer}. No collision. Movability: DESTROY.

**Visual**: Dark red (SS=0) to bright red (SS=15). Shape per D7.

**Interaction**: Right-click toggles cross↔dot when 0 connections.

**Redstone**: SS ∈ {0..15}. Propagates instantly.

*Receives* (maximum of):
- Adjacent on-lever: 15
- Adjacent active button: 15
- Adjacent active pressure plate: plate's SS
- Adjacent strongly-powered block: 15
- Adjacent repeater/comparator outputting toward dust: their SS
- Adjacent lit torch: 15
- Adjacent observer (pulsing) outputting toward dust: 15
- Adjacent redstone block: 15
- Connected dust: max(0, source.SS - 1)

*Provides* (when SS ≥ 1):
- Weakly powers: block beneath; block dust points toward
- Activates: piston beneath; piston dust points toward
- Powers: repeater/comparator whose back dust touches
- Dot: only affects block beneath

**State**: power, north, south, east, west

---

## Repeater

**Physical**: On top of {solid block, slime block, upside-down slab/stairs}. Height 2/16. No collision. Movability: DESTROY.

**Visual**: Flat slab with arrow. Two torches (back fixed, movable indicates delay). Gray bar when locked.

**Interaction**: Right-click cycles delay 1→2→3→4→1 rt.

**Redstone**: Delay ∈ {1,2,3,4} rt = {2,4,6,8} gt.

*Input* (back only): Powered when any of:
- Dust at back (SS≥1) pointing toward or adjacent
- Powered block at back (strongly or weakly)
- Repeater/comparator outputting into back
- On-lever, active button, active pressure plate, lit torch at back
- Observer outputting into back
- Redstone block at back

*Output* (front, when powered AND not locked):
- SS: 15
- Strongly powers block at front
- Powers dust/repeater/comparator at front
- Activates piston at front (not via piston's front face)

*Locking*: Powered repeater/comparator front touches this side → output frozen.

*Timing*: Output changes [delay] after input. Pulses < delay extended to delay.

**State**: facing, delay, locked, powered

---

## Comparator

**Physical**: On top of {solid block, slime block, upside-down slab/stairs}. Height 2/16. No collision. Movability: DESTROY.

**Visual**: Flat slab with arrow. Three torches (two back, one front). Front torch lit = subtract mode.

**Interaction**: Right-click toggles compare↔subtract.

**Redstone**: Delay 1 rt (2 gt). Does not respond to pulses < 1 rt.

*Rear Input* R = max SS from back:
- Dust: its SS
- Powered block: 15
- Repeater/comparator/observer outputting: their SS
- On-lever, active button, active pressure plate, lit torch: 15
- Redstone block: 15

*Side Inputs* S = max(left, right) where each side accepts ONLY:
- Dust: its SS
- Redstone block: 15
- Repeater/comparator/observer outputting into side: their SS

*Output*:
- Compare mode: (R ≥ S) ? R : 0
- Subtract mode: max(0, R - S)

*Output behavior*: Strongly powers block at front. Powers dust/repeater/comparator. Activates piston (not via piston's front).

**State**: facing, mode, powered

---

## Redstone Torch

**Physical**: Attaches to {top of solid block/slime block/piston base, side of solid block/slime block}. No bottom attachment. No collision. Movability: DESTROY.

**Visual**: Stick with tip. Lit: red glow, light level 7. Unlit: dark.

**Redstone**: Delay 1 rt (2 gt).

*Input*: Attachment block strongly-powered → torch OFF. Not strongly-powered → torch ON. (Weakly-powered does NOT turn off.)

*Output* (when lit):
- SS=15 to all 6 adjacent EXCEPT attachment block
- Strongly powers block at (torch.X, torch.Y+1, torch.Z)
- Activates adjacent pistons
- Powers repeater/comparator adjacent to their back

*Burnout*: ≥8 state changes in 60 gt → turns off, emits smoke, ignores input until <8 changes in trailing 60 gt, then re-evaluates on next update.

**State**: facing, lit

---

## Piston / Sticky Piston

**Physical**: Facing ∈ {N,S,E,W,up,down}.
- Retracted: 1×1×1, full collision, movability NORMAL
- Extended: base + head (2 blocks), movability IMMOVABLE

*Extension*: Pushes up to 12 blocks. DESTROY blocks drop. NORMAL blocks pushed. Fails if >12 blocks, IMMOVABLE in path, or beyond world.

*Retraction* (sticky only): Pulls NORMAL block at head position. DESTROY/IMMOVABLE not pulled.

**Visual**: Stone base, wood front (piston) or green slime (sticky). Animation 2 gt.

**Redstone**: Activated by signal to any face EXCEPT front:
- Adjacent on-lever, active button, active pressure plate
- Adjacent powered block (strongly or weakly)
- Adjacent lit torch, redstone block
- Dust pointing at or on top (SS≥1)
- Repeater/comparator/observer outputting into non-front face
- **Quasi-connectivity**: above conditions at (piston.X, piston.Y+1, piston.Z); requires block update

*Timing*:
- Start delay: 0-1 gt
- Extension/retraction: 2 gt each

*Short pulse* (<3 gt): Sticky piston "drops" block (pushed block not pulled back).

**State**: facing, extended

---

## Observer

**Physical**: 1×1×1. Full collision. Movability: NORMAL.

**Visual**: Stone with face (front), red dot (back). Dot lights during pulse.

**Redstone**: Non-conductive.

*Triggers* on state change (D6a) at front position:
- Block placed/removed/type changed
- Property changes: dust power, lever/button/pressure plate powered, repeater delay/locked/powered, comparator mode/powered, torch lit, piston extended, observer powered
- Observer moved by piston (triggers once after move)

*Output*: 1 rt delay, then 1 rt pulse (2 gt each) from back:
- SS=15
- Strongly powers block at back
- Powers dust/repeater/comparator at back
- Activates piston at back (not via piston's front)

**State**: facing, powered

---

## Slime Block

**Physical**: 1×1×1. Full collision. Movability: NORMAL with stickiness.

*Stickiness*: Adjacent NORMAL blocks move together when piston moves this. Recursive. Total ≤12 blocks.

*Non-stick*: Honey block, glazed terracotta (not in scope). Slime blocks DO stick to each other.

**Visual**: Translucent green cube.

**Redstone**: Conductive (can be powered). Does not emit. Affects attached torch like solid block.

**Entity physics**:
- Friction: 0.8 (normal=0.6, ice=0.98)
- Landing: bounce (velocity inverted), no fall damage. Sneaking: no bounce, takes damage. Jump held: no bounce, no damage.

**State**: (none)

---

## Redstone Block

**Physical**: 1×1×1. Full collision. Movability: NORMAL.

**Visual**: Red cube with circuit pattern.

**Redstone**: Permanently active. Cannot deactivate.

*Output*:
- Powers adjacent dust to SS=15 (all 6 directions)
- Powers repeater/comparator with back touching
- Activates adjacent pistons (not via piston's front)
- Side input SS=15 to adjacent comparators
- Does NOT power adjacent solid blocks

*Torch*: Acts as strongly-powered for torch attachment. Torch turns off after 1 rt.

**State**: (none)

---

## Block Update Propagation

**Trigger**: Block at P undergoes state change (D6a).

*Recipients*:
1. All 6 adjacent to P
2. All 6 adjacent to (P.X, P.Y+1, P.Z) — quasi-connectivity

*Response*:
- Dust: recalculates SS
- Repeater/comparator: re-evaluates, schedules change
- Torch: re-evaluates attachment power
- Piston: re-evaluates activation
- Observer: no response (watches state changes, not updates)
- Support-dependent: validates support, drops if invalid

---

## Timing Reference

| Component | Delay | Duration |
|-----------|-------|----------|
| Lever | 0 | toggle |
| Stone button | 0 | 20 gt (1.0s) |
| Wood button | 0 | 30 gt (1.5s) |
| Stone/wood pressure plate | 0 | ≥20 gt |
| Weighted pressure plate | 0 | ≥10 gt |
| Dust | 0 | — |
| Repeater | 2/4/6/8 gt | — |
| Comparator | 2 gt | — |
| Torch | 2 gt | — |
| Observer | 2 gt | 2 gt pulse |
| Piston | 0-1 gt start | 2 gt motion |
| Torch burnout | — | ≥8 changes/60 gt |

---

*13 blocks. All values verified against minecraft.wiki, Java Edition 1.21.*