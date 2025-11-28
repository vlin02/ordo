import { Engine } from "./engine.js"
import { Vec, X, Y, Z } from "./vec.js"
import { Solid } from "./blocks/solid.js"
import { Slime } from "./blocks/slime.js"
import { RedstoneBlock } from "./blocks/redstone-block.js"
import { Dust } from "./blocks/dust.js"
import { Lever } from "./blocks/lever.js"
import { Button, type ButtonVariant } from "./blocks/button.js"
import { Torch } from "./blocks/torch.js"
import { Repeater } from "./blocks/repeater.js"
import { Comparator, type ComparatorMode } from "./blocks/comparator.js"
import { Piston } from "./blocks/piston.js"
import { StickyPiston } from "./blocks/sticky-piston.js"
import { Observer } from "./blocks/observer.js"
import { PressurePlate, type PressurePlateVariant } from "./blocks/pressure-plate.js"
import type { Block } from "./blocks/index.js"

export type Direction = "+x" | "-x" | "+y" | "-y" | "+z" | "-z"

function dirToVec(dir: Direction): Vec {
  switch (dir) {
    case "+x": return X
    case "-x": return X.neg
    case "+y": return Y
    case "-y": return Y.neg
    case "+z": return Z
    case "-z": return Z.neg
  }
}

// Block definition types (declarative, position-free)
export type SolidDef = { type: "solid" }
export type SlimeDef = { type: "slime" }
export type RedstoneBlockDef = { type: "redstone-block" }
export type DustDef = { type: "dust" }
export type LeverDef = { type: "lever"; face: Direction }
export type ButtonDef = { type: "button"; face: Direction; variant?: ButtonVariant }
export type TorchDef = { type: "torch"; face: Direction }
export type RepeaterDef = { type: "repeater"; facing: Direction; delay?: 2 | 4 | 6 | 8 }
export type ComparatorDef = { type: "comparator"; facing: Direction; mode?: ComparatorMode }
export type PistonDef = { type: "piston"; facing: Direction }
export type StickyPistonDef = { type: "sticky-piston"; facing: Direction }
export type ObserverDef = { type: "observer"; facing: Direction }
export type PressurePlateDef = { type: "pressure-plate"; variant?: PressurePlateVariant }

export type BlockDef =
  | SolidDef
  | SlimeDef
  | RedstoneBlockDef
  | DustDef
  | LeverDef
  | ButtonDef
  | TorchDef
  | RepeaterDef
  | ComparatorDef
  | PistonDef
  | StickyPistonDef
  | ObserverDef
  | PressurePlateDef
  | null // air

export type Cell = BlockDef

// A slice is a 2D grid (w x l) representing one horizontal layer
export type Slice = Cell[][]

export interface Contraption {
  width: number   // x dimension
  length: number  // z dimension
  height: number  // y dimension
  slices: Slice[] // from y=0 (bottom) to y=height-1 (top)
  offset?: { x?: number; y?: number; z?: number } // optional world offset
}

function createBlock(def: BlockDef, pos: Vec): Block | null {
  if (!def) return null

  switch (def.type) {
    case "solid":
      return new Solid(pos)
    case "slime":
      return new Slime(pos)
    case "redstone-block":
      return new RedstoneBlock(pos)
    case "dust":
      return new Dust(pos)
    case "lever": {
      const face = dirToVec(def.face)
      const attachedPos = pos.add(face)
      return new Lever(pos, face, attachedPos)
    }
    case "button": {
      const face = dirToVec(def.face)
      const attachedPos = pos.add(face)
      return new Button(pos, face, attachedPos, def.variant ?? "stone")
    }
    case "torch": {
      // face is direction FROM torch TO attached block
      const face = dirToVec(def.face)
      const attachedPos = pos.add(face)
      return new Torch(pos, face, attachedPos)
    }
    case "repeater": {
      const facing = dirToVec(def.facing)
      const repeater = new Repeater(pos, facing)
      if (def.delay) repeater.delay = def.delay
      return repeater
    }
    case "comparator": {
      const facing = dirToVec(def.facing)
      return new Comparator(pos, facing, def.mode ?? "comparison")
    }
    case "piston":
      return new Piston(pos, dirToVec(def.facing))
    case "sticky-piston":
      return new StickyPiston(pos, dirToVec(def.facing))
    case "observer":
      return new Observer(pos, dirToVec(def.facing))
    case "pressure-plate":
      return new PressurePlate(pos, def.variant ?? "stone")
  }
}

export interface BuildResult {
  engine: Engine
  placed: Vec[]
  failed: Vec[]
}

export function buildContraption(contraption: Contraption): BuildResult {
  const { width, length, height, slices, offset } = contraption
  const engine = new Engine()
  const placed: Vec[] = []
  const failed: Vec[] = []

  const offsetX = offset?.x ?? 0
  const offsetY = offset?.y ?? 0
  const offsetZ = offset?.z ?? 0

  // Collect all blocks to place with their positions
  const pending: { pos: Vec; def: BlockDef }[] = []

  for (let y = 0; y < height; y++) {
    const slice = slices[y]
    if (!slice) continue

    for (let x = 0; x < width; x++) {
      for (let z = 0; z < length; z++) {
        const def = slice[z]?.[x]
        if (def) {
          pending.push({ pos: new Vec(x + offsetX, y + offsetY, z + offsetZ), def })
        }
      }
    }
  }

  // Iteratively place blocks until none can be placed
  let prevPendingCount = -1
  while (pending.length > 0 && pending.length !== prevPendingCount) {
    prevPendingCount = pending.length
    
    for (let i = 0; i < pending.length; i++) {
      const { pos, def } = pending[i]
      const block = createBlock(def, pos)
      if (!block) {
        pending.splice(i--, 1)
        continue
      }

      try {
        engine.placeBlock(block)
        placed.push(pos)
        pending.splice(i--, 1)
      } catch {
        // Block can't be placed yet, try again next iteration
      }
    }
  }

  // Remaining blocks couldn't be placed
  for (const { pos } of pending) {
    failed.push(pos)
  }

  return { engine, placed, failed }
}

// Shorthand builders for common block defs
export const B = {
  solid: (): SolidDef => ({ type: "solid" }),
  slime: (): SlimeDef => ({ type: "slime" }),
  redstone: (): RedstoneBlockDef => ({ type: "redstone-block" }),
  dust: (): DustDef => ({ type: "dust" }),
  lever: (face: Direction): LeverDef => ({ type: "lever", face }),
  button: (face: Direction, variant?: ButtonVariant): ButtonDef => ({ type: "button", face, variant }),
  torch: (face: Direction): TorchDef => ({ type: "torch", face }),
  repeater: (facing: Direction, delay?: 2 | 4 | 6 | 8): RepeaterDef => ({ type: "repeater", facing, delay }),
  comparator: (facing: Direction, mode?: ComparatorMode): ComparatorDef => ({ type: "comparator", facing, mode }),
  piston: (facing: Direction): PistonDef => ({ type: "piston", facing }),
  stickyPiston: (facing: Direction): StickyPistonDef => ({ type: "sticky-piston", facing }),
  observer: (facing: Direction): ObserverDef => ({ type: "observer", facing }),
  pressurePlate: (variant?: PressurePlateVariant): PressurePlateDef => ({ type: "pressure-plate", variant }),
  air: null as null,
}


