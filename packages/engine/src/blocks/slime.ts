import { Vec } from "../vec.js"
import type { World } from "../world.js"
import type { PowerState } from "./solid.js"

export class Slime {
  readonly type = "slime" as const
  readonly world: World
  pos: Vec
  powerState: PowerState

  constructor(world: World, pos: Vec) {
    this.world = world
    this.pos = pos
    this.powerState = "unpowered"
  }
}
