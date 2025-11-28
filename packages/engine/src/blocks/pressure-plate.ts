import { Vec } from "../vec.js"
import type { BlockType } from "./index.js"

export type PressurePlateVariant = "wood" | "stone" | "light_weighted" | "heavy_weighted"

export class PressurePlate {
  readonly type = "pressure-plate" as const
  readonly pos: Vec
  readonly variant: PressurePlateVariant
  entityCount: number
  active: boolean
  scheduledDeactivationCheck: number | null

  constructor(pos: Vec, variant: PressurePlateVariant = "stone") {
    this.pos = pos
    this.variant = variant
    this.entityCount = 0
    this.active = false
    this.scheduledDeactivationCheck = null
  }

  getOutputSignal(): number {
    if (!this.active || this.entityCount === 0) return 0

    switch (this.variant) {
      case "wood":
      case "stone":
        return 15
      case "light_weighted":
        return Math.min(this.entityCount, 15)
      case "heavy_weighted":
        return Math.min(Math.ceil(this.entityCount / 10), 15)
    }
  }

  activate(currentTick: number): number {
    this.active = true
    this.scheduledDeactivationCheck = currentTick + 20
    return this.scheduledDeactivationCheck
  }

  tryCheckDeactivation(currentTick: number): { deactivated: boolean; nextCheckTick?: number } {
    if (this.scheduledDeactivationCheck === null || currentTick < this.scheduledDeactivationCheck) {
      return { deactivated: false }
    }

    if (this.entityCount === 0 && this.active) {
      this.active = false
      this.scheduledDeactivationCheck = null
      return { deactivated: true }
    }

    if (this.entityCount > 0) {
      this.scheduledDeactivationCheck = currentTick + 20
      return { deactivated: false, nextCheckTick: this.scheduledDeactivationCheck }
    }

    return { deactivated: false }
  }
}

export function shouldPressurePlateDrop(supportBlock: { type: BlockType } | null): boolean {
  if (!supportBlock) return true
  return supportBlock.type !== "solid"
}
