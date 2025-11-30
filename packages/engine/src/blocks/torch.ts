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
  scheduledToggle: number | null
  stateChangeTimes: number[]
  burnedOut: boolean

  constructor(world: World, pos: Vec, attachedFace: Vec, attachedPos: Vec) {
    this.world = world
    this.pos = pos
    this.attachedFace = attachedFace
    this.attachedPos = attachedPos
    this.lit = true
    this.scheduledToggle = null
    this.stateChangeTimes = []
    this.burnedOut = false
  }

  onUpdate(): void {
    if (this.scheduledToggle !== null) return
    if (this.checkBurnout()) return
    if (this.lit === this.shouldBeLit()) return

    this.scheduledToggle = this.world.currentTick + 2
    this.world.scheduleUpdate(this.pos, 2)
  }

  processScheduled(): boolean {
    if (this.scheduledToggle === null) return false
    if (this.world.currentTick < this.scheduledToggle) return false

    if (this.burnedOut) {
      this.scheduledToggle = null
      return false
    }

    this.lit = !this.lit
    this.stateChangeTimes.push(this.world.currentTick)
    this.scheduledToggle = null
    return true
  }

  private checkBurnout(): boolean {
    if (this.burnedOut) return true
    const currentTick = this.world.currentTick
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

  stronglyPowers(pos: Vec): boolean {
    if (!this.lit) return false
    return pos.equals(this.pos.add(Y))
  }

  weaklyPowers(pos: Vec): boolean {
    if (!this.lit) return false
    if (pos.equals(this.pos.add(Y))) return false
    if (pos.equals(this.attachedPos)) return false
    return this.pos.isAdjacent(pos)
  }
}
