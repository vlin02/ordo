import { Vec } from "../vec.js"

export class Observer {
  readonly type = "observer" as const
  pos: Vec
  readonly facing: Vec
  outputOn: boolean
  scheduledPulseStart: number | null
  scheduledPulseEnd: number | null

  constructor(pos: Vec, facing: Vec) {
    this.pos = pos
    this.facing = facing
    this.outputOn = false
    this.scheduledPulseStart = null
    this.scheduledPulseEnd = null
  }

  schedulePulse(currentTick: number): { start: number; end: number } | null {
    if (this.scheduledPulseStart !== null || this.scheduledPulseEnd !== null) return null
    this.scheduledPulseStart = currentTick + 2
    this.scheduledPulseEnd = this.scheduledPulseStart + 2
    return { start: this.scheduledPulseStart, end: this.scheduledPulseEnd }
  }

  tryStartPulse(currentTick: number): boolean {
    if (this.scheduledPulseStart === null || currentTick < this.scheduledPulseStart) return false
    this.outputOn = true
    this.scheduledPulseStart = null
    return true
  }

  tryEndPulse(currentTick: number): boolean {
    if (this.scheduledPulseEnd === null || currentTick < this.scheduledPulseEnd) return false
    this.outputOn = false
    this.scheduledPulseEnd = null
    return true
  }
}
