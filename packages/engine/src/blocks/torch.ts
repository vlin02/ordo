import { Vec, Y } from "../vec.js"

export class Torch {
  readonly type = "torch" as const
  readonly pos: Vec
  readonly attachedFace: Vec
  readonly attachedPos: Vec
  lit: boolean
  scheduledStateChange: number | null
  stateChangeTimes: number[]
  burnedOut: boolean

  constructor(pos: Vec, attachedFace: Vec, attachedPos: Vec) {
    this.pos = pos
    this.attachedFace = attachedFace
    this.attachedPos = attachedPos
    this.lit = true
    this.scheduledStateChange = null
    this.stateChangeTimes = []
    this.burnedOut = false
  }

  scheduleToggle(currentTick: number): number {
    this.scheduledStateChange = currentTick + 2
    return this.scheduledStateChange
  }

  tryConsumeToggle(currentTick: number): boolean {
    if (this.scheduledStateChange === null || currentTick < this.scheduledStateChange) return false
    if (this.burnedOut) {
      this.scheduledStateChange = null
      return false
    }
    this.lit = !this.lit
    this.stateChangeTimes.push(currentTick)
    this.scheduledStateChange = null
    return true
  }

  isBurnedOut(currentTick: number): boolean {
    if (this.burnedOut) return true
    this.stateChangeTimes = this.stateChangeTimes.filter(time => currentTick - time < 60)
    if (this.stateChangeTimes.length >= 8) {
      this.lit = false
      this.burnedOut = true
      return true
    }
    return false
  }
}

import type { BlockType } from "./index.js"

export type TorchAttachableBlock = { type: BlockType; extended?: boolean } | null

export function shouldTorchDrop(attachedBlock: TorchAttachableBlock, attachedFace: Vec): boolean {
  if (!attachedBlock) return true
  if (attachedFace.equals(Y)) return true
  if (attachedBlock.type === "solid") return false
  if (attachedBlock.type === "slime") return false
  if (attachedBlock.type === "redstone-block") return false
  if ((attachedBlock.type === "piston" || attachedBlock.type === "sticky-piston") && attachedFace.equals(Y.neg)) return false
  return true
}
