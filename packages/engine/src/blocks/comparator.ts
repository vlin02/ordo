import { Vec, Y } from "../vec.js"
import type { World } from "../world.js"

export type ComparatorMode = "comparison" | "subtraction"

export class Comparator {
  readonly type = "comparator" as const
  readonly world: World
  readonly pos: Vec
  readonly facing: Vec
  mode: ComparatorMode
  rearSignal: number
  leftSignal: number
  rightSignal: number
  outputSignal: number
  scheduledOutputChange: number | null
  scheduledOutputSignal: number | null

  constructor(world: World, pos: Vec, facing: Vec, mode: ComparatorMode = "comparison") {
    this.world = world
    this.pos = pos
    this.facing = facing
    this.mode = mode
    this.rearSignal = 0
    this.leftSignal = 0
    this.rightSignal = 0
    this.outputSignal = 0
    this.scheduledOutputChange = null
    this.scheduledOutputSignal = null
  }

  toggleMode(): void {
    this.mode = this.mode === "comparison" ? "subtraction" : "comparison"
  }

  calculateOutput(): number {
    const sideMax = Math.max(this.leftSignal, this.rightSignal)

    if (this.mode === "comparison") {
      return this.rearSignal >= sideMax ? this.rearSignal : 0
    } else {
      return Math.max(0, this.rearSignal - sideMax)
    }
  }

  scheduleOutput(currentTick: number, signal: number): number {
    this.scheduledOutputChange = currentTick + 2
    this.scheduledOutputSignal = signal
    return this.scheduledOutputChange
  }

  tryConsumeSchedule(currentTick: number): boolean {
    if (this.scheduledOutputChange === null || currentTick < this.scheduledOutputChange) return false
    this.outputSignal = this.scheduledOutputSignal!
    this.scheduledOutputChange = null
    this.scheduledOutputSignal = null
    return true
  }

  shouldDrop(): boolean {
    const below = this.world.getBlock(this.pos.add(Y.neg))
    if (!below) return true
    return below.type !== "solid" && below.type !== "slime"
  }
}
 