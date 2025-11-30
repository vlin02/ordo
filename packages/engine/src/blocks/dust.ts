import { Vec, Y, HORIZONTALS } from "../vec.js"
import type { World } from "../world.js"

export type DustShape = "cross" | "dot"

export class Dust {
  readonly type = "dust" as const
  readonly movability = "destroy" as const
  readonly world: World
  readonly pos: Vec
  signalStrength: number
  shape: DustShape

  constructor(world: World, pos: Vec) {
    this.world = world
    this.pos = pos
    this.signalStrength = 0
    this.shape = "cross"
  }

  toggleShape(): void {
    this.shape = this.shape === "cross" ? "dot" : "cross"
  }

  shouldDrop(): boolean {
    const below = this.world.getBlock(this.pos.add(Y.neg))
    if (!below) return true
    if (below.type === "solid") return false
    if (below.type === "slime") return false
    return true
  }

  updateSignal(): boolean {
    const newSignal = this.calculateSignal()
    if (newSignal !== this.signalStrength) {
      this.signalStrength = newSignal
      return true
    }
    return false
  }

  private calculateSignal(): number {
    let maxSignal = 0

    // Check non-dust power sources
    for (const adjPos of this.pos.adjacents()) {
      const adjBlock = this.world.getBlock(adjPos)
      if (adjBlock?.type === "dust") continue
      const signal = this.world.getSignalToward(adjPos, this.pos)
      if (signal > maxSignal) maxSignal = signal
    }
    if (maxSignal === 15) return 15

    // Check connected dust (with decay)
    for (const connPos of this.findConnections()) {
      const connBlock = this.world.getBlock(connPos)
      if (connBlock?.type === "dust") {
        const signal = connBlock.signalStrength - 1
        if (signal > maxSignal) maxSignal = signal
      }
    }
    return maxSignal
  }

  isPointingAt(target: Vec): boolean {
    if (this.shape === "dot") return false
    if (target.y !== this.pos.y) return false

    const dx = target.x - this.pos.x
    const dz = target.z - this.pos.z
    if (!((Math.abs(dx) === 1 && dz === 0) || (dx === 0 && Math.abs(dz) === 1))) {
      return false
    }

    const connections = this.findConnections()
    if (connections.length === 0) return true // Cross points all directions

    for (const conn of connections) {
      if (Math.sign(conn.x - this.pos.x) === dx && Math.sign(conn.z - this.pos.z) === dz) {
        return true
      }
    }
    return false
  }

  findConnections(): Vec[] {
    const connections: Vec[] = []

    for (const dir of HORIZONTALS) {
      const adjPos = this.pos.add(dir)
      const adjBlock = this.world.getBlock(adjPos)

      if (adjBlock?.type === "dust" || adjBlock?.type === "lever" || adjBlock?.type === "redstone-block" || adjBlock?.type === "torch") {
        connections.push(adjPos)
        continue
      }

      if (adjBlock?.type === "repeater") {
        const back = adjBlock.pos.add(adjBlock.facing.neg)
        const front = adjBlock.pos.add(adjBlock.facing)
        if (this.pos.equals(back) || this.pos.equals(front)) {
          connections.push(adjPos)
          continue
        }
      }

      if (adjBlock?.type === "observer") {
        const back = adjBlock.pos.add(adjBlock.facing.neg)
        if (this.pos.equals(back)) {
          connections.push(adjPos)
          continue
        }
      }

      if (adjBlock?.type === "comparator") {
        const back = adjBlock.pos.add(adjBlock.facing.neg)
        const front = adjBlock.pos.add(adjBlock.facing)
        if (this.pos.equals(back) || this.pos.equals(front)) {
          connections.push(adjPos)
          continue
        }
      }

      // Step-down
      if (!adjBlock || (adjBlock.type !== "solid" && adjBlock.type !== "slime")) {
        const belowPos = adjPos.add(Y.neg)
        const belowBlock = this.world.getBlock(belowPos)
        if (belowBlock?.type === "dust") {
          const aboveBelow = this.world.getBlock(belowPos.add(Y))
          if (aboveBelow?.type !== "solid" && aboveBelow?.type !== "slime") {
            connections.push(belowPos)
          }
        }
      }

      // Step-up
      if (adjBlock?.type === "solid" || adjBlock?.type === "slime") {
        const aboveAdjPos = adjPos.add(Y)
        const aboveAdjBlock = this.world.getBlock(aboveAdjPos)
        if (aboveAdjBlock?.type === "dust") {
          const aboveCurrent = this.world.getBlock(this.pos.add(Y))
          if (aboveCurrent?.type !== "solid" && aboveCurrent?.type !== "slime") {
            connections.push(aboveAdjPos)
          }
        }
      }
    }

    return connections
  }
}
