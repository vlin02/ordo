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

export interface PlacementFailure {
  pos: Vec
  reason: string
}

export interface ApplyResult {
  blocks: Map<BlockDef, Block>
  failed: PlacementFailure[]
}

export class Assembler {
  readonly player: Player

  constructor(player: Player) {
    this.player = player
  }

  apply(schematic: Schematic, offset: Vec = Vec.ZERO): ApplyResult {
    this.validate(schematic)

    const blocks = new Map<BlockDef, Block>()
    const failed: PlacementFailure[] = []
    const height = schematic.length
    const width = schematic[0]?.length ?? 0
    const length = schematic[0]?.[0]?.length ?? 0

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        for (let z = 0; z < length; z++) {
          const def = schematic[y][x][z]
          if (!def) continue

          const pos = new Vec(x, y, z).add(offset)
          const result = this.placeBlock(def, pos)
          if (result.block) {
            blocks.set(def, result.block)
          } else {
            failed.push({ pos, reason: result.error ?? "Unknown error" })
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

  private placeBlock(def: BlockDef, pos: Vec): { block: Block | null; error?: string } {
    if (!def) return { block: null }

    try {
      let block: Block
      switch (def.type) {
        case "solid":
          block = this.player.solid(pos)
          break
        case "slime":
          block = this.player.slime(pos)
          break
        case "redstone-block":
          block = this.player.redstoneBlock(pos)
          break
        case "dust":
          block = this.player.dust(pos)
          break
        case "lever":
          block = this.player.lever(pos, def.face)
          break
        case "button":
          block = this.player.button(pos, def.face, { variant: def.variant })
          break
        case "torch":
          block = this.player.torch(pos, def.face)
          break
        case "repeater":
          block = this.player.repeater(pos, def.facing, { delay: def.delay })
          break
        case "comparator":
          block = this.player.comparator(pos, def.facing, { mode: def.mode })
          break
        case "piston":
          block = this.player.piston(pos, def.facing)
          break
        case "sticky-piston":
          block = this.player.stickyPiston(pos, def.facing)
          break
        case "observer":
          block = this.player.observer(pos, def.facing)
          break
        case "pressure-plate":
          block = this.player.pressurePlate(pos, { variant: def.variant })
          break
      }
      return { block }
    } catch (e) {
      return { block: null, error: e instanceof Error ? e.message : String(e) }
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

