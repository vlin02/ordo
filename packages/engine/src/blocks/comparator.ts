import { Vec } from "../vec.js"
import type { BlockType } from "./index.js"

export type ComparatorMode = "comparison" | "subtraction"

export class Comparator {
  readonly type = "comparator" as const
  readonly pos: Vec
  readonly facing: Vec
  mode: ComparatorMode
  rearSignal: number
  leftSignal: number
  rightSignal: number
  outputSignal: number
  scheduledOutputChange: number | null
  scheduledOutputSignal: number | null

  constructor(pos: Vec, facing: Vec, mode: ComparatorMode = "comparison") {
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
}

export function shouldComparatorDrop(supportBlock: { type: BlockType } | null): boolean {
  if (!supportBlock) return true
  return supportBlock.type !== "solid" && supportBlock.type !== "slime"
}
