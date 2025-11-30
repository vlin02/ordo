import { Vec } from "../vec.js"
import type { World } from "../world.js"
import type { PowerState } from "./solid.js"

export class Slime {
  readonly type = "slime" as const
  readonly movability = "normal" as const
  readonly world: World
  pos: Vec
  powerState: PowerState

  constructor(world: World, pos: Vec) {
    this.world = world
    this.pos = pos
    this.powerState = "unpowered"
  }

  updatePowerState(): boolean {
    const newState = this.calculatePowerState()
    if (newState !== this.powerState) {
      this.powerState = newState
      return true
    }
    return false
  }

  private calculatePowerState(): PowerState {
    if (this.world.receivesStrongPower(this.pos)) return "strongly-powered"
    if (this.world.receivesWeakPower(this.pos)) return "weakly-powered"
    return "unpowered"
  }
}
