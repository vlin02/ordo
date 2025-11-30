import { Vec, Y } from "../vec.js"
import type { World } from "../world.js"

import type { Movability } from "./solid.js"

export class Piston {
  readonly type: "piston" | "sticky-piston"
  readonly world: World
  pos: Vec
  readonly facing: Vec
  extended: boolean
  activationTick: number | null
  shortPulse: boolean

  get movability(): Movability {
    return this.extended ? "immovable" : "normal"
  }

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
        if (adjPos.add(Y.neg).equals(checkPos) || adjBlock.isPointingAt(checkPos)) {
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

    if (headBlock && headBlock.movability !== "normal") {
      if (headBlock.movability === "destroy") {
        this.world.setBlock(headPos, null)
      }
    }

    const blocksToPush = this.findPushableBlocks()
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

    if (headBlock && headBlock.movability !== "normal") {
      if (headBlock.movability === "destroy") {
        this.world.setBlock(headPos, null)
      }
    }

    const blocksToPush = this.findPushableBlocks()

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

      if (pullBlock && pullBlock.movability === "normal") {
        this.world.moveBlock(pullBlock, headPos)
        this.world.notifyObserversAt(pullPos)
        this.world.notifyObserversAt(headPos)
        this.world.triggerBlockUpdate(pullPos)
        this.world.triggerBlockUpdate(headPos)

        if (pullBlock.type === "observer") {
          this.world.scheduleObserverPulse(pullBlock)
        }
      }
    }

    this.world.triggerBlockUpdate(this.pos)
  }

  findPushableBlocks(): Vec[] | null {
    const toMove = new Set<string>()
    const toCheck: Vec[] = []

    const frontPos = this.pos.add(this.facing)
    const frontBlock = this.world.getBlock(frontPos)
    if (frontBlock && frontBlock.movability === "normal") {
      toCheck.push(frontPos)
      toMove.add(frontPos.toKey())
    } else if (frontBlock) {
      return null
    }

    while (toCheck.length > 0) {
      const pos = toCheck.shift()!
      const block = this.world.getBlock(pos)
      if (!block) continue

      if ((block.type === "piston" || block.type === "sticky-piston") && block.extended) {
        return null
      }

      const destPos = pos.add(this.facing)
      const destBlock = this.world.getBlock(destPos)
      if (destBlock && !toMove.has(destPos.toKey())) {
        if ((destBlock.type === "piston" || destBlock.type === "sticky-piston") && destBlock.extended) {
          return null
        }
        if (destBlock.movability === "normal") {
          toMove.add(destPos.toKey())
          toCheck.push(destPos)
        } else if (destBlock.movability === "immovable") {
          return null
        }
      }

      if (block.type === "slime") {
        for (const adjPos of pos.adjacents()) {
          if (toMove.has(adjPos.toKey())) continue
          if (adjPos.equals(this.pos)) continue

          const adjBlock = this.world.getBlock(adjPos)
          if (adjBlock && adjBlock.movability === "normal") {
            toMove.add(adjPos.toKey())
            toCheck.push(adjPos)
          }
        }
      }

      if (toMove.size > 12) {
        return null
      }
    }

    const positions = Array.from(toMove).map(Vec.fromKey)
    for (const pos of positions) {
      const destPos = pos.add(this.facing)
      if (!toMove.has(destPos.toKey())) {
        const destBlock = this.world.getBlock(destPos)
        if (destBlock && destBlock.movability === "immovable") {
          return null
        }
      }
    }

    return this.sortBlocksForPush(positions)
  }

  private sortBlocksForPush(positions: Vec[]): Vec[] {
    return positions.sort((a, b) => a.dot(this.facing) - b.dot(this.facing))
  }
}
