import { Vec } from "../vec.js"
import type { World } from "../world.js"

export class RedstoneBlock {
  readonly type = "redstone-block" as const
  readonly world: World
  readonly pos: Vec

  constructor(world: World, pos: Vec) {
    this.world = world
    this.pos = pos
  }
}
