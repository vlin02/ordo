import { Vec } from "../vec.js"

export type DustShape = "cross" | "dot"

export class Dust {
  readonly type = "dust" as const
  readonly pos: Vec
  signalStrength: number
  shape: DustShape

  constructor(pos: Vec) {
    this.pos = pos
    this.signalStrength = 0
    this.shape = "cross"
  }

  toggleShape(): void {
    this.shape = this.shape === "cross" ? "dot" : "cross"
  }
}

import type { BlockType } from "./index.js"

export type DustSupportBlock = { type: BlockType; extended?: boolean } | null

export function isDustSupported(belowBlock: DustSupportBlock): boolean {
  if (!belowBlock) return false
  if (belowBlock.type === "solid") return true
  if (belowBlock.type === "slime") return true
  if (belowBlock.type === "observer") return true
  if (belowBlock.type === "piston" || belowBlock.type === "sticky-piston") return true
  return false
}
