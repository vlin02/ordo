import { Vec, Y } from "../vec.js"
import type { World } from "../world.js"

export class Repeater {
  readonly type = "repeater" as const
  readonly movability = "immovable" as const
  readonly world: World
  readonly pos: Vec
  readonly facing: Vec
  delay: number
  powered: boolean
  locked: boolean
  outputOn: boolean
  scheduledChange: number | null
  scheduledState: boolean | null

  constructor(world: World, pos: Vec, facing: Vec) {
    this.world = world
    this.pos = pos
    this.facing = facing
    this.delay = 2
    this.powered = false
    this.locked = false
    this.outputOn = false
    this.scheduledChange = null
    this.scheduledState = null
  }

  cycleDelay(): void {
    const delays = [2, 4, 6, 8]
    const currentIndex = delays.indexOf(this.delay)
    this.delay = delays[(currentIndex + 1) % delays.length]
  }

  onUpdate(): void {
    this.powered = this.isPowered()
    this.locked = this.isLocked()

    if (this.locked) return

    if (this.powered) {
      if (!this.outputOn && this.scheduledState !== true) {
        this.scheduledChange = this.world.currentTick + this.delay
        this.scheduledState = true
        this.world.scheduleUpdate(this.pos, this.delay)
      } else if (this.scheduledState === false) {
        // Cancel pending off
        this.scheduledChange = null
        this.scheduledState = null
      }
    } else {
      if (this.outputOn && this.scheduledState !== false) {
        this.scheduledChange = this.world.currentTick + this.delay
        this.scheduledState = false
        this.world.scheduleUpdate(this.pos, this.delay)
      }
    }
  }

  processScheduled(): boolean {
    if (this.scheduledChange === null) return false
    if (this.world.currentTick < this.scheduledChange) return false

    const newState = this.scheduledState!
    this.outputOn = newState
    this.scheduledChange = null
    this.scheduledState = null

    // Pulse extension: if turned on but input is now off, schedule turning off
    if (newState && !this.isPowered() && !this.locked) {
      this.scheduledChange = this.world.currentTick + this.delay
      this.scheduledState = false
      this.world.scheduleUpdate(this.pos, this.delay)
    }

    return true
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
