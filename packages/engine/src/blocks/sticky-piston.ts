import { Vec } from "../vec.js"

export class StickyPiston {
  readonly type = "sticky-piston" as const
  pos: Vec
  readonly facing: Vec
  extended: boolean
  activationTick: number | null
  shortPulse: boolean

  constructor(pos: Vec, facing: Vec) {
    this.pos = pos
    this.facing = facing
    this.extended = false
    this.activationTick = null
    this.shortPulse = false
  }
}
