import { Vec, Y, HORIZONTALS, DIAGONALS_Y } from "./vec.js"
import { Solid, type PowerState } from "./blocks/solid.js"
import { Lever, shouldLeverDrop } from "./blocks/lever.js"
import { Dust, isDustSupported } from "./blocks/dust.js"
import { Piston } from "./blocks/piston.js"
import { StickyPiston } from "./blocks/sticky-piston.js"
import { Repeater, shouldRepeaterDrop } from "./blocks/repeater.js"
import { Torch, shouldTorchDrop } from "./blocks/torch.js"
import { Observer } from "./blocks/observer.js"
import { Button, shouldButtonDrop } from "./blocks/button.js"
import { Slime } from "./blocks/slime.js"
import { PressurePlate, shouldPressurePlateDrop } from "./blocks/pressure-plate.js"
import { Comparator, shouldComparatorDrop } from "./blocks/comparator.js"
import type { Block } from "./blocks/index.js"
import { type Snapshot, serializeBlock, deserializeBlock } from "./snapshot.js"
import type { EngineEvent } from "./events.js"
import { PowerGraph, describeBlockState, type PowerNode, type PowerEdge } from "./power-graph.js"
import { renderSlice, type SliceAxis } from "./slice.js"

export type EventHandler = (event: EngineEvent) => void

export class Engine {
  readonly grid: Map<string, Block>
  tickCounter: number
  readonly updateQueue: Set<string>
  readonly scheduledEvents: Map<number, Set<string>>
  onEvent: EventHandler | null = null

  constructor() {
    this.grid = new Map()
    this.tickCounter = 0
    this.updateQueue = new Set()
    this.scheduledEvents = new Map()
  }

  // ============ USER API ============

  placeBlock(block: Block): void {
    const existing = this.getBlock(block.pos)
    if (existing) {
      throw new Error(`Cannot place block: position ${block.pos} already occupied by ${existing.type}`)
    }

    const supportError = this.validateBlockSupport(block)
    if (supportError) {
      throw new Error(`Cannot place ${block.type}: ${supportError}`)
    }

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
      this.onLeverToggled(block)
      this.notifyObserversAt(block.pos)
      this.triggerBlockUpdate(block.pos)
    } else if (block.type === "dust") {
      const newShape = block.shape === "cross" ? "dot" : "cross"
      this.onDustShapeChanged(block, newShape)
      this.notifyObserversAt(block.pos)
      this.triggerBlockUpdate(block.pos)
    } else if (block.type === "repeater") {
      const delays = [2, 4, 6, 8]
      const currentIndex = delays.indexOf(block.delay)
      const newDelay = delays[(currentIndex + 1) % delays.length]
      this.onRepeaterDelayChanged(block, newDelay)
      this.notifyObserversAt(block.pos)
    } else if (block.type === "button") {
      if (block.pressed) {
        throw new Error(`Cannot interact: button at ${block.pos} is already pressed`)
      }
      const duration = block.variant === "wood" ? 30 : 20
      const releaseTick = this.tickCounter + duration
      this.onButtonPressed(block, releaseTick)
      this.scheduleEvent(releaseTick, block.pos)
      this.triggerBlockUpdate(block.pos)
    } else if (block.type === "comparator") {
      const newMode = block.mode === "comparison" ? "subtraction" : "comparison"
      this.onComparatorModeChanged(block, newMode)
      this.notifyObserversAt(block.pos)
      this.triggerBlockUpdate(block.pos)
    }

    this.processBlockUpdates()
  }

  setEntityCount(plate: PressurePlate, counts: { all: number; mobs: number }): void {
    const wasActive = plate.active
    const newCount = plate.variant === "stone" ? counts.mobs : counts.all
    this.onPlateEntitiesChanged(plate, newCount)

    if (plate.entityCount > 0 && !wasActive) {
      const checkTick = this.tickCounter + 20
      this.onPlateActivated(plate, checkTick)
      this.notifyObserversAt(plate.pos)
      this.triggerBlockUpdate(plate.pos)
      this.scheduleEvent(checkTick, plate.pos)
    }

    this.processBlockUpdates()
  }

  tick(): void {
    this.onTick()

    const positions = this.scheduledEvents.get(this.tickCounter)
    if (positions) {
      for (const key of positions) {
        this.updateQueue.add(key)
      }
      this.scheduledEvents.delete(this.tickCounter)
    }

    this.processBlockUpdates()
  }

  // ============ QUERIES ============

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

  static fromSnapshot(snapshot: Snapshot): Engine {
    const engine = new Engine()

    for (const blockState of snapshot.blocks) {
      const block = deserializeBlock(blockState)
      engine.grid.set(block.pos.toKey(), block)
    }

    for (const { tick, positions } of snapshot.events ?? []) {
      for (const pos of positions) {
        let set = engine.scheduledEvents.get(tick)
        if (!set) {
          set = new Set()
          engine.scheduledEvents.set(tick, set)
        }
        set.add(pos)
      }
    }

    engine.tickCounter = snapshot.tickCounter ?? 0
    return engine
  }

  private validateBlockSupport(block: Block): string | null {
    switch (block.type) {
      case "dust": {
        const below = this.getBlock(block.pos.add(Y.neg))
        if (!isDustSupported(below)) {
          return `needs solid/slime/piston/observer support below at ${block.pos.add(Y.neg)}`
        }
        break
      }
      case "lever": {
        const attached = this.getBlock(block.attachedPos)
        if (shouldLeverDrop(attached)) {
          return `needs solid/piston attachment at ${block.attachedPos}`
        }
        break
      }
      case "button": {
        const attached = this.getBlock(block.attachedPos)
        if (shouldButtonDrop(attached)) {
          return `needs solid block attachment at ${block.attachedPos}`
        }
        break
      }
      case "torch": {
        const attached = this.getBlock(block.attachedPos)
        if (shouldTorchDrop(attached, block.attachedFace)) {
          return `needs valid attachment at ${block.attachedPos}`
        }
        break
      }
      case "repeater": {
        const below = this.getBlock(block.pos.add(Y.neg))
        if (shouldRepeaterDrop(below)) {
          return `needs solid/slime block below at ${block.pos.add(Y.neg)}`
        }
        break
      }
      case "comparator": {
        const below = this.getBlock(block.pos.add(Y.neg))
        if (shouldComparatorDrop(below)) {
          return `needs solid/slime block below at ${block.pos.add(Y.neg)}`
        }
        break
      }
      case "pressure-plate": {
        const below = this.getBlock(block.pos.add(Y.neg))
        if (shouldPressurePlateDrop(below)) {
          return `needs solid block below at ${block.pos.add(Y.neg)}`
        }
        break
      }
    }
    return null
  }

  // ============ EVENT PRIMITIVES (internal, but public for event system) ============

  private emit(event: EngineEvent): void {
    this.onEvent?.(event)
  }

  onBlockPlaced(block: Block): void {
    this.grid.set(block.pos.toKey(), block)
    this.emit({ type: "structural.block_placed", block })
  }

  onBlockRemoved(pos: Vec): void {
    this.grid.delete(pos.toKey())
    this.emit({ type: "structural.block_removed", pos })
  }

  onBlockMoved(block: Block, from: Vec, to: Vec): void {
    this.grid.delete(from.toKey())
    ;(block as { pos: Vec }).pos = to
    this.grid.set(to.toKey(), block)
    this.emit({ type: "structural.block_moved", block, from, to })
  }

  onLeverToggled(lever: Lever): void {
    lever.on = !lever.on
    this.emit({ type: "lever.toggled", block: lever, on: lever.on })
  }

  onButtonPressed(button: Button, releaseTick: number): void {
    button.pressed = true
    button.scheduledRelease = releaseTick
    this.emit({ type: "button.pressed", block: button, releaseTick })
  }

  onButtonReleased(button: Button): void {
    button.pressed = false
    button.scheduledRelease = null
    this.emit({ type: "button.released", block: button })
  }

  onPlateEntitiesChanged(plate: PressurePlate, count: number): void {
    plate.entityCount = count
    this.emit({ type: "plate.entities_changed", block: plate, count })
  }

  onPlateActivated(plate: PressurePlate, checkTick: number): void {
    plate.active = true
    plate.scheduledDeactivationCheck = checkTick
    this.emit({ type: "plate.activated", block: plate, checkTick })
  }

  onPlateDeactivated(plate: PressurePlate): void {
    plate.active = false
    plate.scheduledDeactivationCheck = null
    this.emit({ type: "plate.deactivated", block: plate })
  }

  onPlateCheckRescheduled(plate: PressurePlate, checkTick: number): void {
    plate.scheduledDeactivationCheck = checkTick
    this.emit({ type: "plate.check_rescheduled", block: plate, checkTick })
  }

  onDustSignalChanged(dust: Dust, signal: number): void {
    dust.signalStrength = signal
    this.emit({ type: "dust.signal_changed", block: dust, signal })
  }

  onDustShapeChanged(dust: Dust, shape: "cross" | "dot"): void {
    dust.shape = shape
    this.emit({ type: "dust.shape_changed", block: dust, shape })
  }

  onPowerStateChanged(block: Solid | Slime, state: PowerState): void {
    block.powerState = state
    this.emit({ type: "solid.power_state_changed", block, state })
  }

  onRepeaterDelayChanged(repeater: Repeater, delay: number): void {
    repeater.delay = delay
    this.emit({ type: "repeater.delay_changed", block: repeater, delay })
  }

  onRepeaterInputChanged(repeater: Repeater, powered: boolean, locked: boolean): void {
    repeater.powered = powered
    repeater.locked = locked
    this.emit({ type: "repeater.input_changed", block: repeater, powered, locked })
  }

  onRepeaterOutputScheduled(repeater: Repeater, tick: number, state: boolean): void {
    repeater.scheduledOutputChange = tick
    repeater.scheduledOutputState = state
    this.emit({ type: "repeater.output_scheduled", block: repeater, tick, state })
  }

  onRepeaterOutputChanged(repeater: Repeater, on: boolean): void {
    repeater.outputOn = on
    repeater.scheduledOutputChange = null
    repeater.scheduledOutputState = null
    this.emit({ type: "repeater.output_changed", block: repeater, on })
  }

  onRepeaterScheduleCancelled(repeater: Repeater): void {
    repeater.scheduledOutputChange = null
    repeater.scheduledOutputState = null
    this.emit({ type: "repeater.schedule_cancelled", block: repeater })
  }

  onComparatorModeChanged(comparator: Comparator, mode: "comparison" | "subtraction"): void {
    comparator.mode = mode
    this.emit({ type: "comparator.mode_changed", block: comparator, mode })
  }

  onComparatorInputsChanged(
    comparator: Comparator,
    rear: number,
    left: number,
    right: number
  ): void {
    comparator.rearSignal = rear
    comparator.leftSignal = left
    comparator.rightSignal = right
    this.emit({ type: "comparator.inputs_changed", block: comparator, rear, left, right })
  }

  onComparatorOutputScheduled(comparator: Comparator, tick: number, signal: number): void {
    comparator.scheduledOutputChange = tick
    comparator.scheduledOutputSignal = signal
    this.emit({ type: "comparator.output_scheduled", block: comparator, tick, signal })
  }

  onComparatorOutputChanged(comparator: Comparator, signal: number): void {
    comparator.outputSignal = signal
    comparator.scheduledOutputChange = null
    comparator.scheduledOutputSignal = null
    this.emit({ type: "comparator.output_changed", block: comparator, signal })
  }

  onTorchScheduled(torch: Torch, tick: number): void {
    torch.scheduledStateChange = tick
    this.emit({ type: "torch.scheduled", block: torch, tick })
  }

  onTorchStateChanged(torch: Torch, lit: boolean, stateChangeTimes: number[]): void {
    torch.lit = lit
    torch.stateChangeTimes = stateChangeTimes
    torch.scheduledStateChange = null
    this.emit({
      type: "torch.state_changed",
      block: torch,
      lit,
      stateChangeTimes: [...stateChangeTimes],
    })
  }

  onTorchBurnout(torch: Torch, stateChangeTimes: number[]): void {
    torch.lit = false
    torch.burnedOut = true
    torch.stateChangeTimes = stateChangeTimes
    this.emit({ type: "torch.burnout", block: torch, stateChangeTimes: [...stateChangeTimes] })
  }

  onPistonScheduled(piston: Piston | StickyPiston, tick: number): void {
    piston.activationTick = tick
    piston.shortPulse = false
    this.emit({ type: "piston.scheduled", block: piston, tick })
  }

  onPistonExtended(piston: Piston | StickyPiston): void {
    piston.extended = true
    piston.activationTick = null
    this.emit({ type: "piston.extended", block: piston })
  }

  onPistonRetracted(piston: Piston | StickyPiston): void {
    piston.extended = false
    piston.activationTick = null
    piston.shortPulse = false
    this.emit({ type: "piston.retracted", block: piston })
  }

  onPistonAborted(piston: Piston | StickyPiston): void {
    piston.activationTick = null
    this.emit({ type: "piston.aborted", block: piston })
  }

  onPistonShortPulse(piston: Piston | StickyPiston): void {
    piston.shortPulse = true
    this.emit({ type: "piston.short_pulse", block: piston })
  }

  onObserverPulseScheduled(observer: Observer, startTick: number, endTick: number): void {
    observer.scheduledPulseStart = startTick
    observer.scheduledPulseEnd = endTick
    this.emit({ type: "observer.pulse_scheduled", block: observer, startTick, endTick })
  }

  onObserverPulseStarted(observer: Observer): void {
    observer.outputOn = true
    observer.scheduledPulseStart = null
    this.emit({ type: "observer.pulse_started", block: observer })
  }

  onObserverPulseEnded(observer: Observer): void {
    observer.outputOn = false
    observer.scheduledPulseEnd = null
    this.emit({ type: "observer.pulse_ended", block: observer })
  }

  onTick(): void {
    this.tickCounter++
    this.emit({ type: "meta.tick", tick: this.tickCounter })
  }

  // ============ PRIVATE ============

  private scheduleEvent(tick: number, pos: Vec): void {
    const key = pos.toKey()
    if (!this.scheduledEvents.has(tick)) {
      this.scheduledEvents.set(tick, new Set())
    }
    this.scheduledEvents.get(tick)!.add(key)
  }

  private setBlock(pos: Vec, block: Block | null): void {
    if (block === null) {
      this.onBlockRemoved(pos)
    } else {
      this.onBlockPlaced(block)
    }

    this.notifyObserversAt(pos)
  }

  private notifyObserversAt(changedPos: Vec): void {
    for (const adjPos of changedPos.adjacents()) {
      const block = this.getBlock(adjPos)
      if (block?.type === "observer") {
        const observedPos = block.pos.add(block.facing)
        if (observedPos.equals(changedPos)) {
          this.triggerObserverPulse(block)
        }
      }
    }
  }

  private triggerObserverPulse(observer: Observer): void {
    if (observer.scheduledPulseStart !== null || observer.scheduledPulseEnd !== null) return
    const startTick = this.tickCounter + 2
    const endTick = startTick + 2
    this.onObserverPulseScheduled(observer, startTick, endTick)
    this.scheduleEvent(startTick, observer.pos)
    this.scheduleEvent(endTick, observer.pos)
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
          this.checkPistonActivation(block)
        }

        if (block && this.shouldBlockDrop(block)) {
          this.setBlock(pos, null)
        }
      }
    }
  }

  private triggerBlockUpdate(pos: Vec): void {
    this.updateQueue.add(pos.toKey())

    for (const adjPos of pos.adjacents()) {
      this.updateQueue.add(adjPos.toKey())
    }
  }

  private shouldBlockDrop(block: Block): boolean {
    switch (block.type) {
      case "dust":
        return !isDustSupported(this.getBlock(block.pos.add(Y.neg)))
      case "lever":
        return shouldLeverDrop(this.getBlock(block.attachedPos))
      case "repeater":
        return shouldRepeaterDrop(this.getBlock(block.pos.add(Y.neg)))
      case "torch":
        return shouldTorchDrop(this.getBlock(block.attachedPos), block.attachedFace)
      case "button":
        return shouldButtonDrop(this.getBlock(block.attachedPos))
      case "pressure-plate":
        return shouldPressurePlateDrop(this.getBlock(block.pos.add(Y.neg)))
      case "comparator":
        return shouldComparatorDrop(this.getBlock(block.pos.add(Y.neg)))
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
        const oldSignal = block.signalStrength
        const newSignal = this.calculateDustSignal(block)
        if (newSignal !== oldSignal) {
          this.onDustSignalChanged(block, newSignal)
          changed = true
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
        const oldState = block.powerState
        const newState = this.calculatePowerState(block.pos)
        if (newState !== oldState) {
          this.onPowerStateChanged(block, newState)
          changed = true
        }
        break
      }
      case "repeater": {
        // Try to consume scheduled output change
        if (
          block.scheduledOutputChange !== null &&
          this.tickCounter >= block.scheduledOutputChange
        ) {
          const newState = block.scheduledOutputState!
          this.onRepeaterOutputChanged(block, newState)
          changed = true
          // If turned on but input is now off, schedule turning off (pulse extension)
          if (newState && !this.isRepeaterPowered(block) && !block.locked) {
            const offTick = this.tickCounter + block.delay
            this.onRepeaterOutputScheduled(block, offTick, false)
            this.scheduleEvent(offTick, block.pos)
          }
        }

        // Update input state
        const newPowered = this.isRepeaterPowered(block)
        const newLocked = this.isRepeaterLocked(block)
        if (newPowered !== block.powered || newLocked !== block.locked) {
          this.onRepeaterInputChanged(block, newPowered, newLocked)
        }

        // Schedule output changes based on input
        if (!block.locked) {
          if (block.powered) {
            if (!block.outputOn && block.scheduledOutputState !== true) {
              const scheduleTick = this.tickCounter + block.delay
              this.onRepeaterOutputScheduled(block, scheduleTick, true)
              this.scheduleEvent(scheduleTick, block.pos)
            } else if (block.scheduledOutputState === false) {
              this.onRepeaterScheduleCancelled(block)
            }
          } else {
            if (block.outputOn && block.scheduledOutputState !== false) {
              const scheduleTick = this.tickCounter + block.delay
              this.onRepeaterOutputScheduled(block, scheduleTick, false)
              this.scheduleEvent(scheduleTick, block.pos)
            }
          }
        }
        break
      }
      case "torch": {
        // Try to consume scheduled toggle
        if (block.scheduledStateChange !== null && this.tickCounter >= block.scheduledStateChange) {
          if (!block.burnedOut) {
            const newLit = !block.lit
            const newTimes = [...block.stateChangeTimes, this.tickCounter]
            this.onTorchStateChanged(block, newLit, newTimes)
            changed = true
          } else {
            block.scheduledStateChange = null
          }
        }

        // Check burnout and schedule toggle if needed
        const shouldSchedule = this.updateTorchState(block)
        if (shouldSchedule && block.scheduledStateChange === null) {
          const scheduleTick = this.tickCounter + 2
          this.onTorchScheduled(block, scheduleTick)
          this.scheduleEvent(scheduleTick, block.pos)
        }
        break
      }
      case "piston":
      case "sticky-piston": {
        if (block.activationTick !== null && this.tickCounter >= block.activationTick + 2) {
          if (!block.extended) {
            this.completePistonExtension(block)
          } else {
            this.completePistonRetraction(block)
          }
        }
        break
      }
      case "observer": {
        // Try to start pulse
        if (block.scheduledPulseStart !== null && this.tickCounter >= block.scheduledPulseStart) {
          this.onObserverPulseStarted(block)
          changed = true
        }
        // Try to end pulse
        if (block.scheduledPulseEnd !== null && this.tickCounter >= block.scheduledPulseEnd) {
          this.onObserverPulseEnded(block)
          changed = true
        }
        break
      }
      case "button": {
        if (block.scheduledRelease !== null && this.tickCounter >= block.scheduledRelease) {
          this.onButtonReleased(block)
          changed = true
        }
        break
      }
      case "pressure-plate": {
        if (
          block.scheduledDeactivationCheck !== null &&
          this.tickCounter >= block.scheduledDeactivationCheck
        ) {
          if (block.entityCount === 0 && block.active) {
            this.onPlateDeactivated(block)
            changed = true
          } else if (block.entityCount > 0) {
            const nextCheckTick = this.tickCounter + 20
            this.onPlateCheckRescheduled(block, nextCheckTick)
            this.scheduleEvent(nextCheckTick, block.pos)
          }
        }
        break
      }
      case "comparator": {
        // Try to consume scheduled output change
        if (
          block.scheduledOutputChange !== null &&
          this.tickCounter >= block.scheduledOutputChange
        ) {
          const newSignal = block.scheduledOutputSignal!
          this.onComparatorOutputChanged(block, newSignal)
          changed = true
        }

        // Calculate new inputs and schedule output if needed
        const { rear, left, right, output: newOutput } = this.calculateComparatorState(block)
        if (rear !== block.rearSignal || left !== block.leftSignal || right !== block.rightSignal) {
          this.onComparatorInputsChanged(block, rear, left, right)
        }
        if (newOutput !== block.outputSignal && block.scheduledOutputChange === null) {
          const scheduleTick = this.tickCounter + 2
          this.onComparatorOutputScheduled(block, scheduleTick, newOutput)
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

  // DEBUG: Query methods for observability
  shouldTorchBeLit(torch: Torch): boolean {
    const attachedBlock = this.getBlock(torch.attachedPos)
    if (!attachedBlock) return true
    if (attachedBlock.type === "redstone-block") return false
    if (attachedBlock.type !== "solid" && attachedBlock.type !== "slime") return true

    return !this.isStronglyPowered(torch.attachedPos)
  }

  private updateTorchState(torch: Torch): boolean {
    if (torch.isBurnedOut(this.tickCounter)) return false
    const shouldBeLit = this.shouldTorchBeLit(torch)
    if (torch.lit === shouldBeLit) return false
    return true
  }

  outputsTo(block: Block, targetPos: Vec): number {
    if (block.type === "repeater" && block.outputOn) {
      if (block.pos.add(block.facing).equals(targetPos)) return 15
    }
    if (block.type === "observer" && block.outputOn) {
      if (block.pos.add(block.facing.neg).equals(targetPos)) return 15
    }
    if (block.type === "comparator" && block.outputSignal > 0) {
      if (block.pos.add(block.facing).equals(targetPos)) return block.outputSignal
    }
    return 0
  }

  receivesStrongPower(pos: Vec): boolean {
    for (const adjPos of pos.adjacents()) {
      const block = this.getBlock(adjPos)
      if (!block) continue

      if (block.type === "lever" && block.on && block.attachedPos.equals(pos)) {
        return true
      }

      if (block.type === "button" && block.pressed && block.attachedPos.equals(pos)) {
        return true
      }

      if (this.outputsTo(block, pos) > 0) return true
    }

    const below = pos.add(Y.neg)
    const belowBlock = this.getBlock(below)
    if (belowBlock?.type === "torch" && belowBlock.lit) return true

    const above = pos.add(Y)
    const aboveBlock = this.getBlock(above)
    if (aboveBlock?.type === "pressure-plate" && aboveBlock.active) return true
    // Note: dust above WEAKLY powers block beneath, not strongly (moved to receivesWeakPower)

    return false
  }

  receivesWeakPower(pos: Vec): boolean {
    if (this.receivesStrongPower(pos)) return true

    for (const adjPos of pos.adjacents()) {
      const block = this.getBlock(adjPos)
      if (!block) continue

      if (block.type === "dust" && block.signalStrength >= 1 && this.isDustPointingAt(block, pos)) {
        return true
      }

      if (block.type === "torch" && block.lit) {
        const aboveTorch = block.pos.add(Y)
        if (!aboveTorch.equals(pos) && !block.attachedPos.equals(pos)) {
          return true
        }
      }
    }

    // Dust above weakly powers block beneath it
    const above = pos.add(Y)
    const aboveBlock = this.getBlock(above)
    if (aboveBlock?.type === "dust" && aboveBlock.signalStrength >= 1) {
      return true
    }

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

  hasFullSignal(pos: Vec): boolean {
    for (const adjPos of pos.adjacents()) {
      const block = this.getBlock(adjPos)
      if (!block) continue

      if (block.type === "lever" && block.on) return true
      if (block.type === "torch" && block.lit) return true
      if (block.type === "button" && block.pressed) return true
      if (block.type === "redstone-block") return true
      if (block.type === "pressure-plate" && block.active) return true
      if (this.outputsTo(block, pos) > 0) return true
      if (this.isStronglyPowered(adjPos)) return true
    }

    return false
  }

  private calculatePowerState(pos: Vec): PowerState {
    if (this.receivesStrongPower(pos)) {
      return "strongly-powered"
    } else if (this.receivesWeakPower(pos)) {
      return "weakly-powered"
    } else {
      return "unpowered"
    }
  }

  calculateDustSignal(dust: Dust): number {
    if (this.hasFullSignal(dust.pos)) {
      return 15
    }

    let maxSignal = 0
    const connections = this.findDustConnections(dust)
    for (const connPos of connections) {
      const connBlock = this.getBlock(connPos)
      if (connBlock?.type === "dust") {
        const signal = connBlock.signalStrength - 1
        if (signal > maxSignal) {
          maxSignal = signal
        }
      }
    }

    return maxSignal
  }

  private isDustPointingAt(dust: Dust, target: Vec): boolean {
    if (dust.shape === "dot") return false

    const dy = target.y - dust.pos.y
    if (dy !== 0) return false

    const dx = target.x - dust.pos.x
    const dz = target.z - dust.pos.z
    if (!((Math.abs(dx) === 1 && dz === 0) || (dx === 0 && Math.abs(dz) === 1))) {
      return false
    }

    const connections = this.findDustConnections(dust)

    // No connections = cross shape = points all 4 horizontal directions
    if (connections.length === 0) return true

    // Only points toward connected directions
    for (const conn of connections) {
      const connDx = Math.sign(conn.x - dust.pos.x)
      const connDz = Math.sign(conn.z - dust.pos.z)
      if (connDx === dx && connDz === dz) return true
    }

    return false
  }

  findDustConnections(dust: Dust): Vec[] {
    const connections: Vec[] = []
    const { pos } = dust

    for (const dir of HORIZONTALS) {
      const adjPos = pos.add(dir)
      const adjBlock = this.getBlock(adjPos)

      if (adjBlock?.type === "dust" || adjBlock?.type === "lever" || adjBlock?.type === "torch") {
        connections.push(adjPos)
        continue
      }

      if (adjBlock?.type === "repeater") {
        const repeaterBack = adjBlock.pos.add(adjBlock.facing.neg)
        const repeaterFront = adjBlock.pos.add(adjBlock.facing)
        if (pos.equals(repeaterBack) || pos.equals(repeaterFront)) {
          connections.push(adjPos)
          continue
        }
      }

      if (adjBlock?.type === "observer") {
        const observerBack = adjBlock.pos.add(adjBlock.facing.neg)
        if (pos.equals(observerBack)) {
          connections.push(adjPos)
          continue
        }
      }

      if (adjBlock?.type === "comparator") {
        const comparatorBack = adjBlock.pos.add(adjBlock.facing.neg)
        const comparatorFront = adjBlock.pos.add(adjBlock.facing)
        if (pos.equals(comparatorBack) || pos.equals(comparatorFront)) {
          connections.push(adjPos)
          continue
        }
      }

      // Step-down: dust below adjacent air position
      if (!adjBlock || adjBlock.type !== "solid") {
        const belowPos = adjPos.add(Y.neg)
        const belowBlock = this.getBlock(belowPos)
        if (belowBlock?.type === "dust") {
          const aboveBelow = belowPos.add(Y)
          const aboveBelowBlock = this.getBlock(aboveBelow)
          const blocksDownward =
            aboveBelowBlock?.type === "solid" || aboveBelowBlock?.type === "observer"
          if (!blocksDownward) {
            connections.push(belowPos)
          }
        }
      }

      // Step-up: dust on top of adjacent solid
      if (adjBlock?.type === "solid") {
        const aboveAdjPos = adjPos.add(Y)
        const aboveAdjBlock = this.getBlock(aboveAdjPos)
        if (aboveAdjBlock?.type === "dust") {
          const aboveCurrentDust = pos.add(Y)
          const aboveCurrentBlock = this.getBlock(aboveCurrentDust)
          const blocksUpward = aboveCurrentBlock?.type === "solid"
          if (!blocksUpward) {
            connections.push(aboveAdjPos)
          }
        }
      }
    }

    return connections
  }

  isRepeaterPowered(repeater: Repeater): boolean {
    const backPos = repeater.pos.add(repeater.facing.neg)
    const backBlock = this.getBlock(backPos)

    if (backBlock?.type === "lever" && backBlock.on) return true
    if (backBlock?.type === "dust" && backBlock.signalStrength >= 1) return true

    if (this.isWeaklyPowered(backPos)) {
      return true
    }

    if (this.hasFullSignal(backPos)) return true
    if (backBlock && this.outputsTo(backBlock, repeater.pos) > 0) return true

    return false
  }

  isRepeaterLocked(repeater: Repeater): boolean {
    for (const sideDir of repeater.facing.perpendiculars()) {
      const sidePos = repeater.pos.add(sideDir)
      const sideBlock = this.getBlock(sidePos)

      if (sideBlock?.type === "repeater") {
        const sideFront = sideBlock.pos.add(sideBlock.facing)
        if (sideFront.equals(repeater.pos) && sideBlock.outputOn) {
          return true
        }
      }
    }

    return false
  }

  // COMPARATOR LOGIC
  private calculateComparatorState(comparator: Comparator): {
    rear: number
    left: number
    right: number
    output: number
  } {
    const backPos = comparator.pos.add(comparator.facing.neg)
    const rear = this.getSignalStrengthAt(backPos, comparator.pos)

    const sideDirections = comparator.facing.perpendiculars()
    const left = this.getComparatorSideSignal(comparator.pos, sideDirections[0])
    const right = this.getComparatorSideSignal(comparator.pos, sideDirections[1])

    const sideMax = Math.max(left, right)
    let output: number
    if (comparator.mode === "comparison") {
      output = rear >= sideMax ? rear : 0
    } else {
      output = Math.max(0, rear - sideMax)
    }

    return { rear, left, right, output }
  }

  getSignalStrengthAt(pos: Vec, towardPos: Vec): number {
    const block = this.getBlock(pos)
    if (!block) return 0

    if (block.type === "dust") return block.signalStrength
    if (block.type === "redstone-block") return 15
    if (block.type === "repeater") {
      const front = block.pos.add(block.facing)
      if (front.equals(towardPos) && block.outputOn) return 15
    }
    if (block.type === "comparator") {
      const front = block.pos.add(block.facing)
      if (front.equals(towardPos)) return block.outputSignal
    }
    if (block.type === "observer") {
      const back = block.pos.add(block.facing.neg)
      if (back.equals(towardPos) && block.outputOn) return 15
    }
    if (block.type === "torch" && block.lit) return 15
    if (block.type === "lever" && block.on) return 15
    if (block.type === "button" && block.pressed) return 15
    if (block.type === "pressure-plate" && block.active) return block.getOutputSignal()
    if ((block.type === "solid" || block.type === "slime") && this.isWeaklyPowered(pos)) return 15

    return 0
  }

  getComparatorSideSignal(comparatorPos: Vec, sideDir: Vec): number {
    const sidePos = comparatorPos.add(sideDir)
    const block = this.getBlock(sidePos)
    if (!block) return 0

    if (block.type === "dust") return block.signalStrength
    if (block.type === "redstone-block") return 15

    return this.outputsTo(block, comparatorPos)
  }

  private checkPistonActivation(piston: Piston | StickyPiston): void {
    const shouldActivate = this.shouldPistonActivate(piston)

    if (shouldActivate && !piston.extended && piston.activationTick === null) {
      this.schedulePistonMovement(piston)
    } else if (!shouldActivate && piston.extended && piston.activationTick === null) {
      this.schedulePistonMovement(piston)
    } else if (!shouldActivate && !piston.extended && piston.activationTick !== null) {
      if (this.tickCounter <= piston.activationTick) {
        this.onPistonShortPulse(piston)
        this.abortPistonExtension(piston)
      }
    }
  }

  private abortPistonExtension(piston: Piston | StickyPiston): void {
    const headPos = piston.pos.add(piston.facing)
    const headBlock = this.getBlock(headPos)

    if (headBlock && !this.isBlockMovable(headBlock)) {
      if (this.isBlockDestroyable(headBlock)) {
        this.setBlock(headPos, null)
      }
    }

    const blocksToPush = this.findPushableBlocks(piston)
    if (blocksToPush !== null) {
      this.executePush(blocksToPush, piston.facing)
    }

    this.onPistonAborted(piston)
    this.notifyObserversAt(piston.pos)
    this.triggerBlockUpdate(piston.pos)
  }

  shouldPistonActivate(piston: Piston | StickyPiston): boolean {
    if (this.checkPistonActivationAt(piston, piston.pos)) {
      return true
    }

    const abovePos = piston.pos.add(Y)
    return this.checkPistonActivationAt(piston, abovePos)
  }

  getPowerGraph(): PowerGraph {
    const nodes = new Map<string, PowerNode>()
    const edges: PowerEdge[] = []

    for (const block of this.getAllBlocks()) {
      nodes.set(block.pos.toKey(), {
        pos: block.pos,
        block,
        state: describeBlockState(block),
      })
    }

    for (const block of this.getAllBlocks()) {
      this.collectPowerEdges(block, edges)
    }

    return new PowerGraph(nodes, edges)
  }

  private collectPowerEdges(block: Block, edges: PowerEdge[]): void {
    const pos = block.pos

    switch (block.type) {
      case "lever":
        if (block.on) {
          for (const adj of pos.adjacents()) {
            edges.push({ from: pos, to: adj, type: "signal", signalStrength: 15 })
          }
          const attached = this.getBlock(block.attachedPos)
          if (attached?.type === "solid" || attached?.type === "slime") {
            edges.push({ from: pos, to: block.attachedPos, type: "strong" })
          }
        }
        break

      case "button":
        if (block.pressed) {
          for (const adj of pos.adjacents()) {
            edges.push({ from: pos, to: adj, type: "signal", signalStrength: 15 })
          }
          const attached = this.getBlock(block.attachedPos)
          if (attached?.type === "solid" || attached?.type === "slime") {
            edges.push({ from: pos, to: block.attachedPos, type: "strong" })
          }
        }
        break

      case "pressure-plate":
        if (block.active) {
          const below = pos.add(Y.neg)
          const belowBlock = this.getBlock(below)
          if (belowBlock?.type === "solid" || belowBlock?.type === "slime") {
            edges.push({ from: pos, to: below, type: "strong" })
          }
          for (const adj of pos.adjacents()) {
            edges.push({ from: pos, to: adj, type: "signal", signalStrength: 15 })
          }
        }
        break

      case "redstone-block":
        for (const adj of pos.adjacents()) {
          edges.push({ from: pos, to: adj, type: "signal", signalStrength: 15 })
        }
        break

      case "torch":
        if (block.lit) {
          for (const adj of pos.adjacents()) {
            if (!adj.equals(block.attachedPos)) {
              edges.push({ from: pos, to: adj, type: "signal", signalStrength: 15 })
            }
          }
          const above = pos.add(Y)
          const aboveBlock = this.getBlock(above)
          if (aboveBlock?.type === "solid" || aboveBlock?.type === "slime") {
            edges.push({ from: pos, to: above, type: "strong" })
          }
        }
        break

      case "repeater":
        if (block.outputOn) {
          const front = pos.add(block.facing)
          edges.push({ from: pos, to: front, type: "signal", signalStrength: 15 })
          const frontBlock = this.getBlock(front)
          if (frontBlock?.type === "solid" || frontBlock?.type === "slime") {
            edges.push({ from: pos, to: front, type: "strong" })
          }
        }
        break

      case "comparator":
        if (block.outputSignal > 0) {
          const front = pos.add(block.facing)
          edges.push({ from: pos, to: front, type: "signal", signalStrength: block.outputSignal })
          const frontBlock = this.getBlock(front)
          if (frontBlock?.type === "solid" || frontBlock?.type === "slime") {
            edges.push({ from: pos, to: front, type: "strong" })
          }
        }
        break

      case "observer":
        if (block.outputOn) {
          const back = pos.add(block.facing.neg)
          edges.push({ from: pos, to: back, type: "signal", signalStrength: 15 })
          const backBlock = this.getBlock(back)
          if (backBlock?.type === "solid" || backBlock?.type === "slime") {
            edges.push({ from: pos, to: back, type: "strong" })
          }
        }
        break

      case "dust":
        if (block.signalStrength > 0) {
          const below = pos.add(Y.neg)
          const belowBlock = this.getBlock(below)
          if (belowBlock?.type === "solid" || belowBlock?.type === "slime") {
            edges.push({ from: pos, to: below, type: "weak" })
          }

          if (block.shape !== "dot") {
            const connections = this.findDustConnections(block)
            for (const conn of connections) {
              const connBlock = this.getBlock(conn)
              if (connBlock?.type === "dust") {
                edges.push({ from: pos, to: conn, type: "signal", signalStrength: block.signalStrength - 1 })
              }
            }

            for (const dir of HORIZONTALS) {
              const adj = pos.add(dir)
              if (this.isDustPointingAt(block, adj)) {
                const adjBlock = this.getBlock(adj)
                if (adjBlock?.type === "solid" || adjBlock?.type === "slime") {
                  edges.push({ from: pos, to: adj, type: "weak" })
                }
                if (adjBlock?.type === "piston" || adjBlock?.type === "sticky-piston") {
                  edges.push({ from: pos, to: adj, type: "activation" })
                }
              }
            }
          }

          if (belowBlock?.type === "piston" || belowBlock?.type === "sticky-piston") {
            edges.push({ from: pos, to: below, type: "activation" })
          }
        }
        break

      case "solid":
      case "slime":
        if (block.powerState === "strongly-powered") {
          for (const adj of pos.adjacents()) {
            const adjBlock = this.getBlock(adj)
            if (adjBlock?.type === "dust") {
              edges.push({ from: pos, to: adj, type: "signal", signalStrength: 15 })
            }
          }
        }
        if (block.powerState !== "unpowered") {
          for (const adj of pos.adjacents()) {
            const adjBlock = this.getBlock(adj)
            if (adjBlock?.type === "piston" || adjBlock?.type === "sticky-piston") {
              edges.push({ from: pos, to: adj, type: "activation" })
            }
          }
        }
        break
    }
  }

  private checkPistonActivationAt(piston: Piston | StickyPiston, checkPos: Vec): boolean {
    const frontPos = piston.pos.add(piston.facing)

    for (const adjPos of checkPos.adjacents()) {
      if (adjPos.equals(frontPos) && checkPos.equals(piston.pos)) {
        continue
      }

      const adjBlock = this.getBlock(adjPos)
      if (!adjBlock) continue

      if (adjBlock.type === "lever" && adjBlock.on) return true
      if (adjBlock.type === "button" && adjBlock.pressed) return true
      if (adjBlock.type === "torch" && adjBlock.lit) return true
      if (adjBlock.type === "redstone-block") return true
      if (adjBlock.type === "pressure-plate" && adjBlock.active) return true

      if (
        (adjBlock.type === "solid" || adjBlock.type === "slime") &&
        this.isWeaklyPowered(adjPos)
      ) {
        return true
      }

      if (adjBlock.type === "repeater") {
        const repeaterFront = adjBlock.pos.add(adjBlock.facing)
        if (repeaterFront.equals(checkPos) && adjBlock.outputOn) return true
      }

      if (adjBlock.type === "dust" && adjBlock.signalStrength >= 1) {
        if (adjPos.add(Y.neg).equals(checkPos) || this.isDustPointingAt(adjBlock, checkPos)) {
          return true
        }
      }

      if (adjBlock.type === "observer") {
        const observerBack = adjBlock.pos.add(adjBlock.facing.neg)
        if (observerBack.equals(checkPos) && adjBlock.outputOn) return true
      }

      if (adjBlock.type === "comparator") {
        const comparatorFront = adjBlock.pos.add(adjBlock.facing)
        if (comparatorFront.equals(checkPos) && adjBlock.outputSignal > 0) return true
      }
    }

    return false
  }

  private schedulePistonMovement(piston: Piston | StickyPiston): void {
    const startTick = this.tickCounter + 1
    const completeTick = startTick + 2

    this.onPistonScheduled(piston, startTick)
    this.scheduleEvent(completeTick, piston.pos)
  }

  private completePistonExtension(piston: Piston | StickyPiston): void {
    const headPos = piston.pos.add(piston.facing)
    const headBlock = this.getBlock(headPos)

    if (headBlock && !this.isBlockMovable(headBlock)) {
      if (this.isBlockDestroyable(headBlock)) {
        this.setBlock(headPos, null)
      }
    }

    const blocksToPush = this.findPushableBlocks(piston)

    if (blocksToPush === null) {
      this.onPistonAborted(piston)
      return
    }

    this.executePush(blocksToPush, piston.facing)

    this.onPistonExtended(piston)

    this.notifyObserversAt(piston.pos)
    this.triggerBlockUpdate(piston.pos)
  }

  private completePistonRetraction(piston: Piston | StickyPiston): void {
    const wasShortPulse = piston.shortPulse
    this.onPistonRetracted(piston)
    this.notifyObserversAt(piston.pos)

    if (piston.type === "sticky-piston" && !wasShortPulse) {
      const headPos = piston.pos.add(piston.facing)
      const pullPos = headPos.add(piston.facing)
      const pullBlock = this.getBlock(pullPos)

      if (pullBlock && this.isBlockMovable(pullBlock)) {
        this.onBlockMoved(pullBlock, pullPos, headPos)
        this.notifyObserversAt(pullPos)
        this.notifyObserversAt(headPos)
        this.triggerBlockUpdate(pullPos)
        this.triggerBlockUpdate(headPos)

        if (pullBlock.type === "observer") {
          this.triggerObserverPulse(pullBlock)
        }
      }
    }

    this.triggerBlockUpdate(piston.pos)
  }

  isBlockMovable(block: Block): boolean {
    if (block.type === "solid") return true
    if (block.type === "observer") return true
    if (block.type === "slime") return true
    if ((block.type === "piston" || block.type === "sticky-piston") && !block.extended) return true
    return false
  }

  findPushableBlocks(piston: Piston | StickyPiston): Vec[] | null {
    const toMove = new Set<string>()
    const toCheck: Vec[] = []
    const direction = piston.facing

    const frontPos = piston.pos.add(direction)
    const frontBlock = this.getBlock(frontPos)
    if (frontBlock && this.isBlockMovable(frontBlock)) {
      toCheck.push(frontPos)
      toMove.add(frontPos.toKey())
    } else if (frontBlock) {
      return null
    }

    while (toCheck.length > 0) {
      const pos = toCheck.shift()!
      const block = this.getBlock(pos)
      if (!block) continue

      if ((block.type === "piston" || block.type === "sticky-piston") && block.extended) {
        return null
      }

      const destPos = pos.add(direction)
      const destBlock = this.getBlock(destPos)
      if (destBlock && !toMove.has(destPos.toKey())) {
        if (
          (destBlock.type === "piston" || destBlock.type === "sticky-piston") &&
          destBlock.extended
        ) {
          return null
        }
        if (this.isBlockMovable(destBlock)) {
          toMove.add(destPos.toKey())
          toCheck.push(destPos)
        } else if (!this.isBlockDestroyable(destBlock)) {
          return null
        }
      }

      if (block.type === "slime") {
        for (const adjPos of pos.adjacents()) {
          if (toMove.has(adjPos.toKey())) continue
          if (adjPos.equals(piston.pos)) continue

          const adjBlock = this.getBlock(adjPos)
          if (adjBlock && this.isBlockMovable(adjBlock)) {
            toMove.add(adjPos.toKey())
            toCheck.push(adjPos)
          }
        }
      }

      if (toMove.size > 12) {
        return null
      }
    }

    const positions = Array.from(toMove).map(Vec.fromKey)
    for (const pos of positions) {
      const destPos = pos.add(direction)
      if (!toMove.has(destPos.toKey())) {
        const destBlock = this.getBlock(destPos)
        if (destBlock && !this.isBlockDestroyable(destBlock)) {
          return null
        }
      }
    }

    return this.sortBlocksForPush(positions, direction)
  }

  isBlockDestroyable(block: Block): boolean {
    return [
      "dust",
      "lever",
      "repeater",
      "torch",
      "button",
      "pressure-plate",
      "comparator",
    ].includes(block.type)
  }

  private sortBlocksForPush(positions: Vec[], direction: Vec): Vec[] {
    return positions.sort((a, b) => a.dot(direction) - b.dot(direction))
  }

  private executePush(blockPositions: Vec[], direction: Vec): void {
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
        if (destBlock && this.isBlockDestroyable(destBlock)) {
          this.onBlockRemoved(newPos)
          this.notifyObserversAt(newPos)
        }

        this.onBlockMoved(block, pos, newPos)
        this.notifyObserversAt(pos)
        this.notifyObserversAt(newPos)

        if (block.type === "observer") {
          movedObservers.push(block)
        }
      }
    }

    for (const observer of movedObservers) {
      this.triggerObserverPulse(observer)
    }

    for (const pos of blockPositions) {
      this.triggerBlockUpdate(pos)
      this.triggerBlockUpdate(pos.add(direction))
    }
  }

  // ============ VISUALIZATION ============

  visualizeSlice(axis: SliceAxis, value: number): string {
    return renderSlice([...this.grid.values()], axis, value)
  }
}
