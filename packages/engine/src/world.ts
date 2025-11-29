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
import { Circuit, trace } from "./kit/circuit.js"

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
      const checkTick = this.tickCounter + 20
      plate.active = true
      plate.scheduledDeactivationCheck = checkTick
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

  moveBlock(from: Vec, to: Vec): void {
    const block = this.getBlock(from)
    if (!block) return
    this.grid.delete(from.toKey())
    ;(block as { pos: Vec }).pos = to
    this.grid.set(to.toKey(), block)
  }

  notifyObserversAt(changedPos: Vec): void {
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

  triggerObserverPulse(observer: Observer): void {
    if (observer.scheduledPulseStart !== null || observer.scheduledPulseEnd !== null) return
    const startTick = this.tickCounter + 2
    const endTick = startTick + 2
    observer.scheduledPulseStart = startTick
    observer.scheduledPulseEnd = endTick
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
  }

  private shouldBlockDrop(block: Block): boolean {
    if ("shouldDrop" in block && typeof block.shouldDrop === "function") {
      return block.shouldDrop()
    }
    return false
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
          block.signalStrength = newSignal
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
          block.powerState = newState
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
          block.outputOn = newState
          block.scheduledOutputChange = null
          block.scheduledOutputState = null
          changed = true
          // If turned on but input is now off, schedule turning off (pulse extension)
          if (newState && !this.isRepeaterPowered(block) && !block.locked) {
            const offTick = this.tickCounter + block.delay
            block.scheduledOutputChange = offTick
            block.scheduledOutputState = false
            this.scheduleEvent(offTick, block.pos)
          }
        }

        // Update input state
        const newPowered = this.isRepeaterPowered(block)
        const newLocked = this.isRepeaterLocked(block)
        if (newPowered !== block.powered || newLocked !== block.locked) {
          block.powered = newPowered
          block.locked = newLocked
        }

        // Schedule output changes based on input
        if (!block.locked) {
          if (block.powered) {
            if (!block.outputOn && block.scheduledOutputState !== true) {
              const scheduleTick = this.tickCounter + block.delay
              block.scheduledOutputChange = scheduleTick
              block.scheduledOutputState = true
              this.scheduleEvent(scheduleTick, block.pos)
            } else if (block.scheduledOutputState === false) {
              block.scheduledOutputChange = null
              block.scheduledOutputState = null
            }
          } else {
            if (block.outputOn && block.scheduledOutputState !== false) {
              const scheduleTick = this.tickCounter + block.delay
              block.scheduledOutputChange = scheduleTick
              block.scheduledOutputState = false
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
            block.lit = newLit
            block.stateChangeTimes = newTimes
            block.scheduledStateChange = null
            changed = true
          } else {
            block.scheduledStateChange = null
          }
        }

        // Check burnout and schedule toggle if needed
        const shouldSchedule = this.updateTorchState(block)
        if (shouldSchedule && block.scheduledStateChange === null) {
          const scheduleTick = this.tickCounter + 2
          block.scheduledStateChange = scheduleTick
          this.scheduleEvent(scheduleTick, block.pos)
        }
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
        // Try to start pulse
        if (block.scheduledPulseStart !== null && this.tickCounter >= block.scheduledPulseStart) {
          block.outputOn = true
          block.scheduledPulseStart = null
          changed = true
        }
        // Try to end pulse
        if (block.scheduledPulseEnd !== null && this.tickCounter >= block.scheduledPulseEnd) {
          block.outputOn = false
          block.scheduledPulseEnd = null
          changed = true
        }
        break
      }
      case "button": {
        if (block.scheduledRelease !== null && this.tickCounter >= block.scheduledRelease) {
          block.pressed = false
          block.scheduledRelease = null
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
            block.active = false
            block.scheduledDeactivationCheck = null
            changed = true
          } else if (block.entityCount > 0) {
            const nextCheckTick = this.tickCounter + 20
            block.scheduledDeactivationCheck = nextCheckTick
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
          block.outputSignal = newSignal
          block.scheduledOutputChange = null
          block.scheduledOutputSignal = null
          changed = true
        }

        // Calculate new inputs and schedule output if needed
        const { rear, left, right, output: newOutput } = this.calculateComparatorState(block)
        if (rear !== block.rearSignal || left !== block.leftSignal || right !== block.rightSignal) {
          block.rearSignal = rear
          block.leftSignal = left
          block.rightSignal = right
        }
        if (newOutput !== block.outputSignal && block.scheduledOutputChange === null) {
          const scheduleTick = this.tickCounter + 2
          block.scheduledOutputChange = scheduleTick
          block.scheduledOutputSignal = newOutput
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

  isDustPointingAt(dust: Dust, target: Vec): boolean {
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

  getCircuit(): Circuit {
    return trace(this)
  }

  isBlockMovable(block: Block): boolean {
    if (block.type === "solid") return true
    if (block.type === "observer") return true
    if (block.type === "slime") return true
    if ((block.type === "piston" || block.type === "sticky-piston") && !block.extended) return true
    return false
  }

  findPushableBlocks(piston: Piston): Vec[] | null {
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
        if (destBlock && this.isBlockDestroyable(destBlock)) {
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
      this.triggerObserverPulse(observer)
    }

    for (const pos of blockPositions) {
      this.triggerBlockUpdate(pos)
      this.triggerBlockUpdate(pos.add(direction))
    }
  }
}
