import { Vec } from "../vec.js"
import type { World } from "../world.js"

export type PowerState = "unpowered" | "weakly-powered" | "strongly-powered"

export class Solid {
  readonly type = "solid" as const
  readonly world: World
  pos: Vec
  powerState: PowerState

  constructor(world: World, pos: Vec) {
    this.world = world
    this.pos = pos
    this.powerState = "unpowered"
  }
}
