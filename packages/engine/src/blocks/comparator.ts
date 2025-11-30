import { Vec, Y } from "../vec.js"
import type { World } from "../world.js"

export type ComparatorMode = "comparison" | "subtraction"

export class Comparator {
  readonly type = "comparator" as const
  readonly movability = "immovable" as const
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

  processScheduledOutput(currentTick: number): boolean {
    if (this.scheduledOutputChange === null || currentTick < this.scheduledOutputChange) {
      return false
    }
    this.outputSignal = this.scheduledOutputSignal!
    this.scheduledOutputChange = null
    this.scheduledOutputSignal = null
    return true
  }

  updateInputs(): { needsSchedule: boolean; newOutput: number } {
    const { rear, left, right, output } = this.calculateState()
    this.rearSignal = rear
    this.leftSignal = left
    this.rightSignal = right
    
    const needsSchedule = output !== this.outputSignal && this.scheduledOutputChange === null
    return { needsSchedule, newOutput: output }
  }

  scheduleOutput(tick: number, signal: number): void {
    this.scheduledOutputChange = tick
    this.scheduledOutputSignal = signal
  }

  shouldDrop(): boolean {
    const below = this.world.getBlock(this.pos.add(Y.neg))
    if (!below) return true
    return below.type !== "solid" && below.type !== "slime"
  }

  calculateState(): { rear: number; left: number; right: number; output: number } {
    const backPos = this.pos.add(this.facing.neg)
    const rear = this.world.getSignalTowardIncludingWeak(backPos, this.pos)

    const sideDirections = this.facing.perpendiculars()
    const left = this.getSideSignal(sideDirections[0])
    const right = this.getSideSignal(sideDirections[1])

    const sideMax = Math.max(left, right)
    const output = this.mode === "comparison"
      ? (rear >= sideMax ? rear : 0)
      : Math.max(0, rear - sideMax)

    return { rear, left, right, output }
  }

  private getSideSignal(sideDir: Vec): number {
    const sidePos = this.pos.add(sideDir)
    const block = this.world.getBlock(sidePos)
    if (!block) return 0

    // Side input only accepts: dust, redstone block, repeater/comparator/observer output
    if (block.type === "dust") return block.signalStrength
    if (block.type === "redstone-block") return 15
    if (block.type === "repeater" || block.type === "comparator" || block.type === "observer") {
      return this.world.getSignalToward(sidePos, this.pos)
    }
    return 0
  }
}
 