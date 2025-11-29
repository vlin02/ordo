import { Vec, Y } from "../vec.js"
import type { World } from "../world.js"

export class Piston {
  readonly type: "piston" | "sticky-piston"
  readonly world: World
  pos: Vec
  readonly facing: Vec
  extended: boolean
  activationTick: number | null
  shortPulse: boolean

  constructor(world: World, pos: Vec, facing: Vec, sticky = false) {
    this.type = sticky ? "sticky-piston" : "piston"
    this.world = world
    this.pos = pos
    this.facing = facing
    this.extended = false
    this.activationTick = null
    this.shortPulse = false
  }

  checkActivation(): void {
    const shouldActivate = this.shouldActivate()

    if (shouldActivate && !this.extended && this.activationTick === null) {
      this.scheduleMovement()
    } else if (!shouldActivate && this.extended && this.activationTick === null) {
      this.scheduleMovement()
    } else if (!shouldActivate && !this.extended && this.activationTick !== null) {
      if (this.world.tickCounter <= this.activationTick) {
        this.shortPulse = true
        this.abortExtension()
      }
    }
  }

  shouldActivate(): boolean {
    if (this.checkActivationAt(this.pos)) return true
    const abovePos = this.pos.add(Y)
    return this.checkActivationAt(abovePos)
  }

  private checkActivationAt(checkPos: Vec): boolean {
    const frontPos = this.pos.add(this.facing)

    for (const adjPos of checkPos.adjacents()) {
      if (adjPos.equals(frontPos) && checkPos.equals(this.pos)) continue

      const adjBlock = this.world.getBlock(adjPos)
      if (!adjBlock) continue

      if (adjBlock.type === "lever" && adjBlock.on) return true
      if (adjBlock.type === "button" && adjBlock.pressed) return true
      if (adjBlock.type === "torch" && adjBlock.lit) return true
      if (adjBlock.type === "redstone-block") return true
      if (adjBlock.type === "pressure-plate" && adjBlock.active) return true

      if (
        (adjBlock.type === "solid" || adjBlock.type === "slime") &&
        this.world.isWeaklyPowered(adjPos)
      ) {
        return true
      }

      if (adjBlock.type === "repeater") {
        const repeaterFront = adjBlock.pos.add(adjBlock.facing)
        if (repeaterFront.equals(checkPos) && adjBlock.outputOn) return true
      }

      if (adjBlock.type === "dust" && adjBlock.signalStrength >= 1) {
        if (adjPos.add(Y.neg).equals(checkPos) || this.world.isDustPointingAt(adjBlock, checkPos)) {
          return true
        }
      }

      if (adjBlock.type === "observer") {
        const observerBack = adjBlock.pos.add(adjBlock.facing.neg)
        if (observerBack.equals(checkPos) && adjBlock.outputOn) return true
      }

      if (adjBlock.type === "comparator") {
        const comparatorFront = adjBlock.pos.add(adjBlock.facing)
        if (comparatorFront.equals(checkPos) && adjBlock.outputSignal > 0) return true
      }
    }

    return false
  }

  private scheduleMovement(): void {
    const startTick = this.world.tickCounter + 1
    const completeTick = startTick + 2

    this.activationTick = startTick
    this.shortPulse = false
    this.world.scheduleEvent(completeTick, this.pos)
  }

  private abortExtension(): void {
    const headPos = this.pos.add(this.facing)
    const headBlock = this.world.getBlock(headPos)

    if (headBlock && !this.world.isBlockMovable(headBlock)) {
      if (this.world.isBlockDestroyable(headBlock)) {
        this.world.setBlock(headPos, null)
      }
    }

    const blocksToPush = this.world.findPushableBlocks(this)
    if (blocksToPush !== null) {
      this.world.executePush(blocksToPush, this.facing)
    }

    this.activationTick = null
    this.world.notifyObserversAt(this.pos)
    this.world.triggerBlockUpdate(this.pos)
  }

  completeExtension(): void {
    const headPos = this.pos.add(this.facing)
    const headBlock = this.world.getBlock(headPos)

    if (headBlock && !this.world.isBlockMovable(headBlock)) {
      if (this.world.isBlockDestroyable(headBlock)) {
        this.world.setBlock(headPos, null)
      }
    }

    const blocksToPush = this.world.findPushableBlocks(this)

    if (blocksToPush === null) {
      this.activationTick = null
      return
    }

    this.world.executePush(blocksToPush, this.facing)

    this.extended = true
    this.activationTick = null

    this.world.notifyObserversAt(this.pos)
    this.world.triggerBlockUpdate(this.pos)
  }

  completeRetraction(): void {
    const wasShortPulse = this.shortPulse
    this.extended = false
    this.activationTick = null
    this.shortPulse = false
    this.world.notifyObserversAt(this.pos)

    if (this.type === "sticky-piston" && !wasShortPulse) {
      const headPos = this.pos.add(this.facing)
      const pullPos = headPos.add(this.facing)
      const pullBlock = this.world.getBlock(pullPos)

      if (pullBlock && this.world.isBlockMovable(pullBlock)) {
        this.world.moveBlock(pullPos, headPos)
        this.world.notifyObserversAt(pullPos)
        this.world.notifyObserversAt(headPos)
        this.world.triggerBlockUpdate(pullPos)
        this.world.triggerBlockUpdate(headPos)

        if (pullBlock.type === "observer") {
          this.world.triggerObserverPulse(pullBlock)
        }
      }
    }

    this.world.triggerBlockUpdate(this.pos)
  }
}
