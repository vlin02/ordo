import { Vec } from "../vec.js"

export type PowerState = "unpowered" | "weakly-powered" | "strongly-powered"

export class Solid {
  readonly type = "solid" as const
  pos: Vec
  powerState: PowerState

  constructor(pos: Vec) {
    this.pos = pos
    this.powerState = "unpowered"
  }
}
