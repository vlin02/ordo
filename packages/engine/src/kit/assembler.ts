import { Vec } from "../vec.js"
import { Player, type Direction } from "../player.js"
import type { ButtonVariant } from "../blocks/button.js"
import type { ComparatorMode } from "../blocks/comparator.js"
import type { PressurePlateVariant } from "../blocks/pressure-plate.js"
import type { Block } from "../blocks/index.js"

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
  | null

export type Schematic = (BlockDef | null)[][][]

export interface ApplyResult {
  blocks: Map<BlockDef, Block>
  failed: Vec[]
}

export class Assembler {
  readonly player: Player

  constructor(player: Player) {
    this.player = player
  }

  apply(schematic: Schematic, offset: Vec = Vec.ZERO): ApplyResult {
    this.validate(schematic)

    const blocks = new Map<BlockDef, Block>()
    const failed: Vec[] = []
    const height = schematic.length
    const width = schematic[0]?.length ?? 0
    const length = schematic[0]?.[0]?.length ?? 0

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        for (let z = 0; z < length; z++) {
          const def = schematic[y][x][z]
          if (!def) continue

          const pos = new Vec(x, y, z).add(offset)
          const block = this.placeBlock(def, pos)
          if (block) {
            blocks.set(def, block)
          } else {
            failed.push(pos)
          }
        }
      }
    }

    return { blocks, failed }
  }

  private validate(schematic: Schematic): void {
    if (schematic.length === 0) return

    const width = schematic[0]?.length ?? 0
    const length = schematic[0]?.[0]?.length ?? 0

    for (let y = 0; y < schematic.length; y++) {
      if (schematic[y].length !== width) {
        throw new Error(`Layer ${y} has width ${schematic[y].length}, expected ${width}`)
      }
      for (let x = 0; x < schematic[y].length; x++) {
        if (schematic[y][x].length !== length) {
          throw new Error(`Layer ${y} row ${x} has length ${schematic[y][x].length}, expected ${length}`)
        }
      }
    }
  }

  private placeBlock(def: BlockDef, pos: Vec): Block | null {
    if (!def) return null

    try {
      switch (def.type) {
        case "solid":
          return this.player.solid(pos)
        case "slime":
          return this.player.slime(pos)
        case "redstone-block":
          return this.player.redstoneBlock(pos)
        case "dust":
          return this.player.dust(pos)
        case "lever":
          return this.player.lever(pos, def.face)
        case "button":
          return this.player.button(pos, def.face, { variant: def.variant })
        case "torch":
          return this.player.torch(pos, def.face)
        case "repeater":
          return this.player.repeater(pos, def.facing, { delay: def.delay })
        case "comparator":
          return this.player.comparator(pos, def.facing, { mode: def.mode })
        case "piston":
          return this.player.piston(pos, def.facing)
        case "sticky-piston":
          return this.player.stickyPiston(pos, def.facing)
        case "observer":
          return this.player.observer(pos, def.facing)
        case "pressure-plate":
          return this.player.pressurePlate(pos, { variant: def.variant })
      }
    } catch {
      return null
    }
  }
}

// Shorthand builders
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
  _: null as null,
}

