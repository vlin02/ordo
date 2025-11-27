import { Vec } from "../vec.js"

export type ButtonVariant = "stone" | "wood"

export class Button {
  readonly type = "button" as const
  readonly pos: Vec
  readonly attachedFace: Vec
  readonly attachedPos: Vec
  readonly variant: ButtonVariant
  pressed: boolean
  scheduledRelease: number | null

  constructor(pos: Vec, attachedFace: Vec, attachedPos: Vec, variant: ButtonVariant = "stone") {
    this.pos = pos
    this.attachedFace = attachedFace
    this.attachedPos = attachedPos
    this.variant = variant
    this.pressed = false
    this.scheduledRelease = null
  }

  press(currentTick: number): number | null {
    if (this.pressed) return null
    this.pressed = true
    const duration = this.variant === "wood" ? 30 : 20
    this.scheduledRelease = currentTick + duration
    return this.scheduledRelease
  }

  tryRelease(currentTick: number): boolean {
    if (this.scheduledRelease === null || currentTick < this.scheduledRelease) return false
    this.pressed = false
    this.scheduledRelease = null
    return true
  }
}

import type { BlockType } from "./index.js"

export function shouldButtonDrop(attachedBlock: { type: BlockType } | null): boolean {
  if (!attachedBlock) return true
  return attachedBlock.type !== "solid"
}
