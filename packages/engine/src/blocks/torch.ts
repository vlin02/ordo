import { Vec, Y } from "../vec.js"
import type { World } from "../world.js"

export class Torch {
  readonly type = "torch" as const
  readonly movability = "destroy" as const
  readonly world: World
  readonly pos: Vec
  readonly attachedFace: Vec
  readonly attachedPos: Vec
  lit: boolean
  scheduledStateChange: number | null
  stateChangeTimes: number[]
  burnedOut: boolean

  constructor(world: World, pos: Vec, attachedFace: Vec, attachedPos: Vec) {
    this.world = world
    this.pos = pos
    this.attachedFace = attachedFace
    this.attachedPos = attachedPos
    this.lit = true
    this.scheduledStateChange = null
    this.stateChangeTimes = []
    this.burnedOut = false
  }

  processScheduledToggle(currentTick: number): boolean {
    if (this.scheduledStateChange === null || currentTick < this.scheduledStateChange) {
      return false
    }
    if (this.burnedOut) {
      this.scheduledStateChange = null
      return false
    }
    this.lit = !this.lit
    this.stateChangeTimes.push(currentTick)
    this.scheduledStateChange = null
    return true
  }

  checkAndScheduleToggle(currentTick: number): number | null {
    if (this.scheduledStateChange !== null) return null
    if (this.checkBurnout(currentTick)) return null
    if (this.lit === this.shouldBeLit()) return null

    const scheduleTick = currentTick + 2
    this.scheduledStateChange = scheduleTick
    return scheduleTick
  }

  private checkBurnout(currentTick: number): boolean {
    if (this.burnedOut) return true
    this.stateChangeTimes = this.stateChangeTimes.filter(time => currentTick - time < 60)
    if (this.stateChangeTimes.length >= 8) {
      this.lit = false
      this.burnedOut = true
      return true
    }
    return false
  }

  shouldDrop(): boolean {
    const attached = this.world.getBlock(this.attachedPos)
    if (!attached) return true
    if (this.attachedFace.equals(Y)) return true
    if (attached.type === "solid") return false
    if (attached.type === "slime") return false
    if (attached.type === "redstone-block") return false
    if ((attached.type === "piston" || attached.type === "sticky-piston") && this.attachedFace.equals(Y.neg)) return false
    return true
  }

  shouldBeLit(): boolean {
    const attachedBlock = this.world.getBlock(this.attachedPos)
    if (!attachedBlock) return true
    if (attachedBlock.type === "redstone-block") return false
    if (attachedBlock.type !== "solid" && attachedBlock.type !== "slime") return true
    return !this.world.isWeaklyPowered(this.attachedPos)
  }
}
