import { Vec } from "../vec.js"
import type { World } from "../world.js"

export type ButtonVariant = "stone" | "wood"

export class Button {
  readonly type = "button" as const
  readonly movability = "destroy" as const
  readonly world: World
  readonly pos: Vec
  readonly attachedFace: Vec
  readonly attachedPos: Vec
  readonly variant: ButtonVariant
  pressed: boolean
  scheduledRelease: number | null

  constructor(world: World, pos: Vec, attachedFace: Vec, attachedPos: Vec, variant: ButtonVariant = "stone") {
    this.world = world
    this.pos = pos
    this.attachedFace = attachedFace
    this.attachedPos = attachedPos
    this.variant = variant
    this.pressed = false
    this.scheduledRelease = null
  }

  press(): void {
    if (this.pressed) return
    this.pressed = true
    const duration = this.variant === "wood" ? 30 : 20
    this.scheduledRelease = this.world.currentTick + duration
    this.world.scheduleUpdate(this.pos, duration)
  }

  processScheduled(): boolean {
    if (this.scheduledRelease === null) return false
    if (this.world.currentTick < this.scheduledRelease) return false
    
    this.pressed = false
    this.scheduledRelease = null
    return true
  }

  shouldDrop(): boolean {
    const attached = this.world.getBlock(this.attachedPos)
    if (!attached) return true
    return attached.type !== "solid"
  }
}
