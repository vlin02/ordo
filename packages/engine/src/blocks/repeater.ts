import { Vec, Y } from "../vec.js"
import type { World } from "../world.js"

export class Repeater {
  readonly type = "repeater" as const
  readonly movability = "destroy" as const
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

  processScheduledOutput(currentTick: number): { changed: boolean; scheduleOffTick?: number } {
    if (this.scheduledOutputChange === null || currentTick < this.scheduledOutputChange) {
      return { changed: false }
    }

    const newState = this.scheduledOutputState!
    this.outputOn = newState
    this.scheduledOutputChange = null
    this.scheduledOutputState = null

    // Pulse extension: if turned on but input is now off, schedule turning off
    if (newState && !this.isPowered() && !this.locked) {
      const offTick = currentTick + this.delay
      this.scheduledOutputChange = offTick
      this.scheduledOutputState = false
      return { changed: true, scheduleOffTick: offTick }
    }

    return { changed: true }
  }

  updateInputState(): void {
    this.powered = this.isPowered()
    this.locked = this.isLocked()
  }

  checkScheduleOutput(currentTick: number): number | null {
    if (this.locked) return null

    if (this.powered) {
      if (!this.outputOn && this.scheduledOutputState !== true) {
        const scheduleTick = currentTick + this.delay
        this.scheduledOutputChange = scheduleTick
        this.scheduledOutputState = true
        return scheduleTick
      } else if (this.scheduledOutputState === false) {
        this.scheduledOutputChange = null
        this.scheduledOutputState = null
      }
    } else {
      if (this.outputOn && this.scheduledOutputState !== false) {
        const scheduleTick = currentTick + this.delay
        this.scheduledOutputChange = scheduleTick
        this.scheduledOutputState = false
        return scheduleTick
      }
    }
    return null
  }

  shouldDrop(): boolean {
    const below = this.world.getBlock(this.pos.add(Y.neg))
    if (!below) return true
    return below.type !== "solid" && below.type !== "slime"
  }

  isPowered(): boolean {
    const backPos = this.pos.add(this.facing.neg)
    return this.world.getSignalTowardIncludingWeak(backPos, this.pos) >= 1
  }

  isLocked(): boolean {
    for (const sideDir of this.facing.perpendiculars()) {
      const sidePos = this.pos.add(sideDir)
      const sideBlock = this.world.getBlock(sidePos)

      if (sideBlock?.type === "repeater") {
        const sideFront = sideBlock.pos.add(sideBlock.facing)
        if (sideFront.equals(this.pos) && sideBlock.outputOn) return true
      }

      if (sideBlock?.type === "comparator") {
        const sideFront = sideBlock.pos.add(sideBlock.facing)
        if (sideFront.equals(this.pos) && sideBlock.outputSignal > 0) return true
      }
    }
    return false
  }
}
