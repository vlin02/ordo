import { Vec, Y } from "../vec.js"
import type { World } from "../world.js"

export class Repeater {
  readonly type = "repeater" as const
  readonly world: World
  readonly pos: Vec
  readonly facing: Vec
  delay: number
  powered: boolean
  locked: boolean
  outputOn: boolean
  scheduledOutputChange: number | null
  scheduledOutputState: boolean | null

  constructor(world: World, pos: Vec, facing: Vec) {
    this.world = world
    this.pos = pos
    this.facing = facing
    this.delay = 2
    this.powered = false
    this.locked = false
    this.outputOn = false
    this.scheduledOutputChange = null
    this.scheduledOutputState = null
  }

  cycleDelay(): void {
    const delays = [2, 4, 6, 8]
    const currentIndex = delays.indexOf(this.delay)
    this.delay = delays[(currentIndex + 1) % delays.length]
  }

  scheduleOutput(currentTick: number, state: boolean): number {
    this.scheduledOutputChange = currentTick + this.delay
    this.scheduledOutputState = state
    return this.scheduledOutputChange
  }

  cancelSchedule(): void {
    this.scheduledOutputChange = null
    this.scheduledOutputState = null
  }

  tryConsumeSchedule(currentTick: number): { changed: boolean; scheduleOff?: number } {
    if (this.scheduledOutputChange === null || currentTick < this.scheduledOutputChange) {
      return { changed: false }
    }

    const newState = this.scheduledOutputState!
    this.outputOn = newState
    this.scheduledOutputChange = null
    this.scheduledOutputState = null

    if (newState && !this.powered && !this.locked) {
      return { changed: true, scheduleOff: currentTick + this.delay }
    }

    return { changed: true }
  }

  shouldDrop(): boolean {
    const below = this.world.getBlock(this.pos.add(Y.neg))
    if (!below) return true
    return below.type !== "solid" && below.type !== "slime"
  }
}
