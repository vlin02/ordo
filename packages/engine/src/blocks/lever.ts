import { Vec } from "../vec.js"
import type { World } from "../world.js"

export class Lever {
  readonly type = "lever" as const
  readonly movability = "destroy" as const
  readonly world: World
  readonly pos: Vec
  readonly attachedFace: Vec
  readonly attachedPos: Vec
  on: boolean

  constructor(world: World, pos: Vec, attachedFace: Vec, attachedPos: Vec) {
    this.world = world
    this.pos = pos
    this.attachedFace = attachedFace
    this.attachedPos = attachedPos
    this.on = false
  }

  toggle(): void {
    this.on = !this.on
  }

  shouldDrop(): boolean {
    const attached = this.world.getBlock(this.attachedPos)
    if (!attached) return true
    return attached.type !== "solid" && attached.type !== "piston" && attached.type !== "sticky-piston"
  }
}

import type { BlockType } from "./index.js"

export function shouldLeverDrop(attachedBlock: { type: BlockType } | null): boolean {
  if (!attachedBlock) return true
  return attachedBlock.type !== "solid" && attachedBlock.type !== "piston" && attachedBlock.type !== "sticky-piston"
}
