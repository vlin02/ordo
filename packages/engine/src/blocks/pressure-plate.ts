import { Vec, Y } from "../vec.js"
import type { World } from "../world.js"

export type PressurePlateVariant = "wood" | "stone" | "light-weighted" | "heavy-weighted"

export class PressurePlate {
  readonly type = "pressure-plate" as const
  readonly movability = "destroy" as const
  readonly world: World
  readonly pos: Vec
  readonly variant: PressurePlateVariant
  entityCount: number
  active: boolean
  scheduledCheck: number | null

  constructor(world: World, pos: Vec, variant: PressurePlateVariant = "stone") {
    this.world = world
    this.pos = pos
    this.variant = variant
    this.entityCount = 0
    this.active = false
    this.scheduledCheck = null
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

  activate(): void {
    this.active = true
    this.scheduledCheck = this.world.currentTick + this.checkInterval
    this.world.scheduleUpdate(this.pos, this.checkInterval)
  }

  processScheduled(): boolean {
    if (this.scheduledCheck === null) return false
    if (this.world.currentTick < this.scheduledCheck) return false

    if (this.entityCount === 0 && this.active) {
      this.active = false
      this.scheduledCheck = null
      return true
    }

    if (this.entityCount > 0) {
      this.scheduledCheck = this.world.currentTick + this.checkInterval
      this.world.scheduleUpdate(this.pos, this.checkInterval)
      return false
    }

    this.scheduledCheck = null
    return false
  }

  shouldDrop(): boolean {
    const below = this.world.getBlock(this.pos.add(Y.neg))
    if (!below) return true
    return below.type !== "solid"
  }
}
