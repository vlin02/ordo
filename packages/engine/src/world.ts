import { Vec, X, Y, Z, HORIZONTALS, DIAGONALS_Y } from "./vec.js"
import { Solid, type PowerState } from "./blocks/solid.js"
import { Lever } from "./blocks/lever.js"
import { Dust } from "./blocks/dust.js"
import { Piston } from "./blocks/piston.js"
import { Repeater } from "./blocks/repeater.js"
import { Torch } from "./blocks/torch.js"
import { Observer } from "./blocks/observer.js"
import { Button, type ButtonVariant } from "./blocks/button.js"
import { Slime } from "./blocks/slime.js"
import { RedstoneBlock } from "./blocks/redstone-block.js"
import { PressurePlate, type PressurePlateVariant } from "./blocks/pressure-plate.js"
import { Comparator, type ComparatorMode } from "./blocks/comparator.js"
import type { Block } from "./blocks/index.js"
import { type Snapshot, serializeBlock, deserializeBlock } from "./snapshot.js"

export class World {
  private grid: Map<string, Block>
  tickCounter: number
  private updateQueue: Set<string>
  private scheduledEvents: Map<number, Set<string>>

  constructor() {
    this.grid = new Map()
    this.tickCounter = 0
    this.updateQueue = new Set()
    this.scheduledEvents = new Map()
  }

  solid(pos: Vec): Solid {
    const block = new Solid(this, pos)
    this.placeBlock(block)
    return block
  }

  slime(pos: Vec): Slime {
    const block = new Slime(this, pos)
    this.placeBlock(block)
    return block
  }

  redstoneBlock(pos: Vec): RedstoneBlock {
    const block = new RedstoneBlock(this, pos)
    this.placeBlock(block)
    return block
  }

  dust(pos: Vec): Dust {
    const block = new Dust(this, pos)
    this.placeBlock(block)
    return block
  }

  lever(pos: Vec, face: Vec): Lever {
    const attachedPos = pos.add(face)
    const block = new Lever(this, pos, face, attachedPos)
    this.placeBlock(block)
    return block
  }

  button(pos: Vec, face: Vec, opts?: { variant?: ButtonVariant }): Button {
    const attachedPos = pos.add(face)
    const block = new Button(this, pos, face, attachedPos, opts?.variant ?? "stone")
    this.placeBlock(block)
    return block
  }

  torch(pos: Vec, face: Vec): Torch {
    const attachedPos = pos.add(face)
    const block = new Torch(this, pos, face, attachedPos)
    this.placeBlock(block)
    return block
  }

  repeater(pos: Vec, facing: Vec, opts?: { delay?: 2 | 4 | 6 | 8 }): Repeater {
    const block = new Repeater(this, pos, facing)
    if (opts?.delay) block.delay = opts.delay
    this.placeBlock(block)
    return block
  }

  comparator(pos: Vec, facing: Vec, opts?: { mode?: ComparatorMode }): Comparator {
    const block = new Comparator(this, pos, facing, opts?.mode ?? "comparison")
    this.placeBlock(block)
    return block
  }

  piston(pos: Vec, facing: Vec): Piston {
    const block = new Piston(this, pos, facing)
    this.placeBlock(block)
    return block
  }

  stickyPiston(pos: Vec, facing: Vec): Piston {
    const block = new Piston(this, pos, facing, true)
    this.placeBlock(block)
    return block
  }

  observer(pos: Vec, facing: Vec): Observer {
    const block = new Observer(this, pos, facing)
    this.placeBlock(block)
    return block
  }

  pressurePlate(pos: Vec, opts?: { variant?: PressurePlateVariant }): PressurePlate {
    const block = new PressurePlate(this, pos, opts?.variant ?? "stone")
    this.placeBlock(block)
    return block
  }

  private placeBlock(block: Block): void {
    this.setBlock(block.pos, block)
    this.triggerBlockUpdate(block.pos)
    this.processBlockUpdates()
  }

  removeBlock(block: Block): void {
    this.setBlock(block.pos, null)
    this.triggerBlockUpdate(block.pos)
    this.processBlockUpdates()
  }

  interact(block: Lever | Dust | Repeater | Button | Comparator): void {
    if (block.type === "lever") {
      block.on = !block.on
      this.notifyObserversAt(block.pos)
      this.triggerBlockUpdate(block.pos)
    } else if (block.type === "dust") {
      const newShape = block.shape === "cross" ? "dot" : "cross"
      block.shape = newShape
      this.notifyObserversAt(block.pos)
      this.triggerBlockUpdate(block.pos)
    } else if (block.type === "repeater") {
      const delays = [2, 4, 6, 8]
      const currentIndex = delays.indexOf(block.delay)
      const newDelay = delays[(currentIndex + 1) % delays.length]
      block.delay = newDelay
      this.notifyObserversAt(block.pos)
    } else if (block.type === "button") {
      if (block.pressed) {
        throw new Error(`Cannot interact: button at ${block.pos} is already pressed`)
      }
      const duration = block.variant === "wood" ? 30 : 20
      const releaseTick = this.tickCounter + duration
      block.pressed = true
      block.scheduledRelease = releaseTick
      this.scheduleEvent(releaseTick, block.pos)
      this.triggerBlockUpdate(block.pos)
    } else if (block.type === "comparator") {
      const newMode = block.mode === "comparison" ? "subtraction" : "comparison"
      block.mode = newMode
      this.notifyObserversAt(block.pos)
      this.triggerBlockUpdate(block.pos)
    }

    this.processBlockUpdates()
  }

  setEntityCount(plate: PressurePlate, counts: { all: number; mobs: number }): void {
    const wasActive = plate.active
    const newCount = plate.variant === "stone" ? counts.mobs : counts.all
    plate.entityCount = newCount

    if (plate.entityCount > 0 && !wasActive) {
      const checkTick = plate.activate(this.tickCounter)
      this.notifyObserversAt(plate.pos)
      this.triggerBlockUpdate(plate.pos)
      this.scheduleEvent(checkTick, plate.pos)
    }

    this.processBlockUpdates()
  }

  tick(): void {
    this.tickCounter++

    const positions = this.scheduledEvents.get(this.tickCounter)
    if (positions) {
      for (const key of positions) {
        this.updateQueue.add(key)
      }
      this.scheduledEvents.delete(this.tickCounter)
    }

    this.processBlockUpdates()
  }

  getBlock(pos: Vec): Block | null {
    return this.grid.get(pos.toKey()) ?? null
  }

  getAllBlocks(): Block[] {
    return Array.from(this.grid.values())
  }

  getCurrentTick(): number {
    return this.tickCounter
  }

  toSnapshot(): Snapshot {
    return {
      tickCounter: this.tickCounter,
      blocks: Array.from(this.grid.values()).map(serializeBlock),
      events: Array.from(this.scheduledEvents).map(([tick, keys]) => ({
        tick,
        positions: Array.from(keys),
      })),
    }
  }

  static fromSnapshot(snapshot: Snapshot): World {
    const world = new World()

    for (const blockState of snapshot.blocks) {
      const block = deserializeBlock(world, blockState)
      world.grid.set(block.pos.toKey(), block)
    }

    for (const { tick, positions } of snapshot.events ?? []) {
      for (const pos of positions) {
        let set = world.scheduledEvents.get(tick)
        if (!set) {
          set = new Set()
          world.scheduledEvents.set(tick, set)
        }
        set.add(pos)
      }
    }

    world.tickCounter = snapshot.tickCounter ?? 0
    return world
  }

  scheduleEvent(tick: number, pos: Vec): void {
    const key = pos.toKey()
    if (!this.scheduledEvents.has(tick)) {
      this.scheduledEvents.set(tick, new Set())
    }
    this.scheduledEvents.get(tick)!.add(key)
  }

  setBlock(pos: Vec, block: Block | null): void {
    if (block === null) {
      this.grid.delete(pos.toKey())
    } else {
      this.grid.set(block.pos.toKey(), block)
    }

    this.notifyObserversAt(pos)
  }

  moveBlock(block: Block, to: Vec): void {
    // Only movable blocks can be moved (those with mutable pos)
    switch (block.type) {
      case "solid":
      case "slime":
      case "observer":
      case "redstone-block":
      case "piston":
      case "sticky-piston":
        this.grid.delete(block.pos.toKey())
        block.pos = to
        this.grid.set(to.toKey(), block)
        break
    }
  }

  notifyObserversAt(changedPos: Vec): void {
    for (const adjPos of changedPos.adjacents()) {
      const block = this.getBlock(adjPos)
      if (block?.type === "observer") {
        const observedPos = block.pos.add(block.facing)
        if (observedPos.equals(changedPos)) {
          this.scheduleObserverPulse(block)
        }
      }
    }
  }

  scheduleObserverPulse(observer: Observer): void {
    const pulse = observer.schedulePulse(this.tickCounter)
    if (pulse) {
      this.scheduleEvent(pulse.start, observer.pos)
      this.scheduleEvent(pulse.end, observer.pos)
    }
  }

  private processBlockUpdates(): void {
    while (this.updateQueue.size > 0) {
      const updates = Array.from(this.updateQueue)
      this.updateQueue.clear()

      for (const key of updates) {
        const pos = Vec.fromKey(key)

        this.processBlockUpdate(pos)

        const block = this.getBlock(pos)
        if (block?.type === "piston" || block?.type === "sticky-piston") {
          block.checkActivation()
        }

        if (block && this.shouldBlockDrop(block)) {
          this.setBlock(pos, null)
        }
      }
    }
  }

  triggerBlockUpdate(pos: Vec): void {
    this.updateQueue.add(pos.toKey())

    for (const adjPos of pos.adjacents()) {
      this.updateQueue.add(adjPos.toKey())
    }

    // Quasi-connectivity: also update all positions adjacent to Y+1
    const abovePos = pos.add(Y)
    for (const adjAbove of abovePos.adjacents()) {
      this.updateQueue.add(adjAbove.toKey())
    }
  }

  private shouldBlockDrop(block: Block): boolean {
    switch (block.type) {
      case "dust":
      case "lever":
      case "button":
      case "pressure-plate":
      case "repeater":
      case "comparator":
      case "torch":
        return block.shouldDrop()
      default:
        return false
    }
  }

  private processBlockUpdate(pos: Vec): boolean {
    const block = this.getBlock(pos)
    if (!block) return false

    let changed = false

    switch (block.type) {
      case "dust": {
        changed = block.updateSignal()
        if (changed) {
          this.notifyObserversAt(pos)
          for (const off of DIAGONALS_Y) {
            const checkPos = pos.add(off)
            const checkBlock = this.getBlock(checkPos)
            if (checkBlock?.type === "dust") {
              this.updateQueue.add(checkPos.toKey())
            }
          }
        }
        break
      }
      case "solid":
      case "slime": {
        changed = block.updatePowerState()
        break
      }
      case "repeater": {
        const result = block.processScheduledOutput(this.tickCounter)
        if (result.changed) changed = true
        if (result.scheduleOffTick) this.scheduleEvent(result.scheduleOffTick, block.pos)

        block.updateInputState()
        const scheduleTick = block.checkScheduleOutput(this.tickCounter)
        if (scheduleTick) this.scheduleEvent(scheduleTick, block.pos)
        break
      }
      case "torch": {
        changed = block.processScheduledToggle(this.tickCounter)
        const scheduleTick = block.checkAndScheduleToggle(this.tickCounter)
        if (scheduleTick) this.scheduleEvent(scheduleTick, block.pos)
        break
      }
      case "piston":
      case "sticky-piston": {
        if (block.activationTick !== null && this.tickCounter >= block.activationTick + 2) {
          if (!block.extended) {
            block.completeExtension()
          } else {
            block.completeRetraction()
          }
        }
        break
      }
      case "observer": {
        if (block.processScheduledPulseStart(this.tickCounter)) changed = true
        if (block.processScheduledPulseEnd(this.tickCounter)) changed = true
        break
      }
      case "button": {
        changed = block.processScheduledRelease(this.tickCounter)
        break
      }
      case "pressure-plate": {
        const result = block.processScheduledDeactivation(this.tickCounter)
        if (result.deactivated) changed = true
        if (result.nextCheckTick) this.scheduleEvent(result.nextCheckTick, block.pos)
        break
      }
      case "comparator": {
        changed = block.processScheduledOutput(this.tickCounter)
        const { needsSchedule, newOutput } = block.updateInputs()
        if (needsSchedule) {
          const scheduleTick = this.tickCounter + 2
          block.scheduleOutput(scheduleTick, newOutput)
          this.scheduleEvent(scheduleTick, block.pos)
        }
        break
      }
    }

    if (changed) {
      for (const adjPos of pos.adjacents()) {
        this.updateQueue.add(adjPos.toKey())
      }
    }

    return changed
  }

  getSignalToward(fromPos: Vec, towardPos: Vec): number {
    const block = this.getBlock(fromPos)
    if (!block) return 0

    // Direct sources
    if (block.type === "lever" && block.on) return 15
    if (block.type === "torch" && block.lit) return 15
    if (block.type === "button" && block.pressed) return 15
    if (block.type === "redstone-block") return 15
    if (block.type === "pressure-plate" && block.active) return block.getOutputSignal()
    if (block.type === "dust") return block.signalStrength

    // Directional outputs
    if (block.type === "repeater" && block.outputOn) {
      if (block.pos.add(block.facing).equals(towardPos)) return 15
    }
    if (block.type === "observer" && block.outputOn) {
      if (block.pos.add(block.facing.neg).equals(towardPos)) return 15
    }
    if (block.type === "comparator" && block.outputSignal > 0) {
      if (block.pos.add(block.facing).equals(towardPos)) return block.outputSignal
    }

    // Strongly-powered conductive block (dust only receives from strongly-powered)
    if ((block.type === "solid" || block.type === "slime") && this.isStronglyPowered(fromPos)) return 15

    return 0
  }

  getSignalTowardIncludingWeak(fromPos: Vec, towardPos: Vec): number {
    const signal = this.getSignalToward(fromPos, towardPos)
    if (signal > 0) return signal

    const block = this.getBlock(fromPos)
    if ((block?.type === "solid" || block?.type === "slime") && this.isWeaklyPowered(fromPos)) return 15
    return 0
  }

  receivesStrongPower(pos: Vec): boolean {
    for (const adjPos of pos.adjacents()) {
      const block = this.getBlock(adjPos)
      if (!block) continue

      if (block.type === "lever" && block.on && block.attachedPos.equals(pos)) return true
      if (block.type === "button" && block.pressed && block.attachedPos.equals(pos)) return true

      // Directional outputs (repeater, comparator, observer)
      if (this.getSignalToward(adjPos, pos) > 0) {
        if (block.type === "repeater" || block.type === "comparator" || block.type === "observer") {
          return true
        }
      }
    }

    const below = pos.add(Y.neg)
    const belowBlock = this.getBlock(below)
    if (belowBlock?.type === "torch" && belowBlock.lit) return true

    const above = pos.add(Y)
    const aboveBlock = this.getBlock(above)
    if (aboveBlock?.type === "pressure-plate" && aboveBlock.active) return true

    return false
  }

  receivesWeakPower(pos: Vec): boolean {
    if (this.receivesStrongPower(pos)) return true

    for (const adjPos of pos.adjacents()) {
      const block = this.getBlock(adjPos)
      if (!block) continue

      if (block.type === "dust" && block.signalStrength >= 1 && block.isPointingAt(pos)) return true

      if (block.type === "torch" && block.lit) {
        const aboveTorch = block.pos.add(Y)
        if (!aboveTorch.equals(pos) && !block.attachedPos.equals(pos)) return true
      }
    }

    const above = pos.add(Y)
    const aboveBlock = this.getBlock(above)
    if (aboveBlock?.type === "dust" && aboveBlock.signalStrength >= 1) return true

    return false
  }

  getBlockPowerState(pos: Vec): PowerState {
    const block = this.getBlock(pos)
    if (block?.type === "solid" || block?.type === "slime") {
      return block.powerState
    }
    return "unpowered"
  }

  isStronglyPowered(pos: Vec): boolean {
    return this.getBlockPowerState(pos) === "strongly-powered"
  }

  isWeaklyPowered(pos: Vec): boolean {
    const state = this.getBlockPowerState(pos)
    return state === "weakly-powered" || state === "strongly-powered"
  }

  executePush(blockPositions: Vec[], direction: Vec): void {
    if (blockPositions.length === 0) {
      return
    }

    const movedObservers: Observer[] = []

    for (let i = blockPositions.length - 1; i >= 0; i--) {
      const pos = blockPositions[i]
      const block = this.getBlock(pos)
      if (block) {
        const newPos = pos.add(direction)

        const destBlock = this.getBlock(newPos)
        if (destBlock && destBlock.movability === "destroy") {
          this.grid.delete(newPos.toKey())
          this.notifyObserversAt(newPos)
        }

        this.grid.delete(pos.toKey())
        ;(block as { pos: Vec }).pos = newPos
        this.grid.set(newPos.toKey(), block)
        this.notifyObserversAt(pos)
        this.notifyObserversAt(newPos)

        if (block.type === "observer") {
          movedObservers.push(block)
        }
      }
    }

    for (const observer of movedObservers) {
      this.scheduleObserverPulse(observer)
    }

    for (const pos of blockPositions) {
      this.triggerBlockUpdate(pos)
      this.triggerBlockUpdate(pos.add(direction))
    }
  }
}
