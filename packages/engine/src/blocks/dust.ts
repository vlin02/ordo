import { Vec, Y } from "../vec.js"
import type { World } from "../world.js"

export type DustShape = "cross" | "dot"

export class Dust {
  readonly type = "dust" as const
  readonly world: World
  readonly pos: Vec
  signalStrength: number
  shape: DustShape

  constructor(world: World, pos: Vec) {
    this.world = world
    this.pos = pos
    this.signalStrength = 0
    this.shape = "cross"
  }

  toggleShape(): void {
    this.shape = this.shape === "cross" ? "dot" : "cross"
  }

  shouldDrop(): boolean {
    const below = this.world.getBlock(this.pos.add(Y.neg))
    if (!below) return true
    if (below.type === "solid") return false
    if (below.type === "slime") return false
    if (below.type === "observer") return false
    if (below.type === "piston" || below.type === "sticky-piston") return false
    return true
  }
}
