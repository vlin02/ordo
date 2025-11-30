import { Vec, Y } from "../vec.js"
import type { World } from "../world.js"

export type PressurePlateVariant = "wood" | "stone" | "light-weighted" | "heavy-weighted"

export class PressurePlate {
  readonly type = "pressure-plate" as const
  readonly world: World
  readonly pos: Vec
  readonly variant: PressurePlateVariant
  entityCount: number
  active: boolean
  scheduledDeactivationCheck: number | null

  constructor(world: World, pos: Vec, variant: PressurePlateVariant = "stone") {
    this.world = world
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
      case "light-weighted":
        return Math.min(this.entityCount, 15)
      case "heavy-weighted":
        return Math.min(Math.ceil(this.entityCount / 10), 15)
    }
  }

  private get checkInterval(): number {
    return this.variant === "light-weighted" || this.variant === "heavy-weighted" ? 10 : 20
  }

  activate(currentTick: number): number {
    this.active = true
    this.scheduledDeactivationCheck = currentTick + this.checkInterval
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
      this.scheduledDeactivationCheck = currentTick + this.checkInterval
      return { deactivated: false, nextCheckTick: this.scheduledDeactivationCheck }
    }

    return { deactivated: false }
  }

  shouldDrop(): boolean {
    const below = this.world.getBlock(this.pos.add(Y.neg))
    if (!below) return true
    return below.type !== "solid"
  }
}
