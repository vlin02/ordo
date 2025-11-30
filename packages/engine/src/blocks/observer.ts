import { Vec } from "../vec.js"
import type { World } from "../world.js"

export class Observer {
  readonly type = "observer" as const
  readonly movability = "normal" as const
  readonly world: World
  pos: Vec
  readonly facing: Vec
  outputOn: boolean
  scheduledPulseStart: number | null
  scheduledPulseEnd: number | null

  constructor(world: World, pos: Vec, facing: Vec) {
    this.world = world
    this.pos = pos
    this.facing = facing
    this.outputOn = false
    this.scheduledPulseStart = null
    this.scheduledPulseEnd = null
  }

  schedulePulse(): void {
    if (this.scheduledPulseStart !== null || this.scheduledPulseEnd !== null) return
    const tick = this.world.currentTick
    this.scheduledPulseStart = tick + 2
    this.scheduledPulseEnd = tick + 4
    this.world.scheduleUpdate(this.pos, 2)
    this.world.scheduleUpdate(this.pos, 4)
  }

  processScheduled(): boolean {
    const tick = this.world.currentTick

    if (this.scheduledPulseStart !== null && tick >= this.scheduledPulseStart) {
      this.outputOn = true
      this.scheduledPulseStart = null
      return true
    }

    if (this.scheduledPulseEnd !== null && tick >= this.scheduledPulseEnd) {
      this.outputOn = false
      this.scheduledPulseEnd = null
      return true
    }

    return false
  }
}
