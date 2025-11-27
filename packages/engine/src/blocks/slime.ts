import { Vec } from "../vec.js"
import type { PowerState } from "./solid.js"

export class Slime {
  readonly type = "slime" as const
  pos: Vec
  powerState: PowerState

  constructor(pos: Vec) {
    this.pos = pos
    this.powerState = "unpowered"
  }
}
