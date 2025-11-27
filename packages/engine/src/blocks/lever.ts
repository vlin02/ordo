import { Vec } from "../vec.js"

export class Lever {
  readonly type = "lever" as const
  readonly pos: Vec
  readonly attachedFace: Vec
  readonly attachedPos: Vec
  on: boolean

  constructor(pos: Vec, attachedFace: Vec, attachedPos: Vec) {
    this.pos = pos
    this.attachedFace = attachedFace
    this.attachedPos = attachedPos
    this.on = false
  }

  toggle(): void {
    this.on = !this.on
  }
}

import type { BlockType } from "./index.js"

export function shouldLeverDrop(attachedBlock: { type: BlockType } | null): boolean {
  if (!attachedBlock) return true
  return attachedBlock.type !== "solid" && attachedBlock.type !== "piston" && attachedBlock.type !== "sticky-piston"
}
