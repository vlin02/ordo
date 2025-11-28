import { Vec, Y, HORIZONTALS, DIAGONALS_Y } from "./vec.js"
import { Solid, type PowerState } from "./blocks/solid.js"
import { shouldLeverDrop } from "./blocks/lever.js"
import { Dust, isDustSupported } from "./blocks/dust.js"
import { Piston } from "./blocks/piston.js"
import { StickyPiston } from "./blocks/sticky-piston.js"
import { Repeater, shouldRepeaterDrop } from "./blocks/repeater.js"
import { Torch, shouldTorchDrop } from "./blocks/torch.js"
import { Observer } from "./blocks/observer.js"
import { shouldButtonDrop } from "./blocks/button.js"
import { Slime } from "./blocks/slime.js"
import { PressurePlate, shouldPressurePlateDrop } from "./blocks/pressure-plate.js"
import { Comparator, shouldComparatorDrop } from "./blocks/comparator.js"
import type { Block } from "./blocks/index.js"
import { type Snapshot, serializeBlock, deserializeBlock } from "./snapshot.js"

export class Engine {
  private grid: Map<string, Block>
  private tickCounter: number
  private updateQueue: Set<string>
  readonly scheduledEvents: Map<number, Set<string>>

  constructor() {
    this.grid = new Map()
    this.tickCounter = 0
    this.updateQueue = new Set()
    this.scheduledEvents = new Map()
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

  private scheduleEvent(tick: number, pos: Vec): void {
    const key = pos.toKey()
    if (!this.scheduledEvents.has(tick)) {
      this.scheduledEvents.set(tick, new Set())
    }
    this.scheduledEvents.get(tick)!.add(key)
  }

  placeBlock(block: Block): void {
    this.setBlock(block.pos, block)
    this.triggerBlockUpdate(block.pos)
    this.processBlockUpdates()
  }

  removeBlock(pos: Vec): void {
    this.setBlock(pos, null)
    this.triggerBlockUpdate(pos)
    this.processBlockUpdates()
  }

  interact(pos: Vec): void {
    const block = this.getBlock(pos)
    if (!block) return

    if (block.type === "lever") {
      block.toggle()
      this.notifyObserversAt(pos)
      this.triggerBlockUpdate(pos)
    } else if (block.type === "dust") {
      block.toggleShape()
      this.notifyObserversAt(pos)
      this.triggerBlockUpdate(pos)
    } else if (block.type === "repeater") {
      block.cycleDelay()
      this.notifyObserversAt(pos)
    } else if (block.type === "button") {
      const releaseTick = block.press(this.tickCounter)
      if (releaseTick) {
        this.scheduleEvent(releaseTick, block.pos)
        this.triggerBlockUpdate(pos)
      }
    } else if (block.type === "comparator") {
      block.toggleMode()
      this.notifyObserversAt(pos)
      this.triggerBlockUpdate(pos)
    }

    this.processBlockUpdates()
  }

  setEntityCount(pos: Vec, count: number): void {
    const block = this.getBlock(pos)
    if (!block || block.type !== "pressure-plate") return

    const wasActive = block.active
    block.entityCount = count

    const shouldBeActive = this.shouldPressurePlateActivate(block)

    if (shouldBeActive && !wasActive) {
      const checkTick = block.activate(this.tickCounter)
      this.notifyObserversAt(pos)
      this.triggerBlockUpdate(pos)
      this.scheduleEvent(checkTick, pos)
    }

    this.processBlockUpdates()
  }

  private shouldPressurePlateActivate(plate: PressurePlate): boolean {
    if (plate.entityCount === 0) return false
    if (plate.variant === "stone") {
      return plate.entityCount > 0
    }
    return plate.entityCount > 0
  }

  getBlock(pos: Vec): Block | null {
    return this.grid.get(pos.toKey()) ?? null
  }

  private setBlock(pos: Vec, block: Block | null): void {
    const key = pos.toKey()

    if (block === null) {
      this.grid.delete(key)
    } else {
      this.grid.set(key, block)
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
    const schedule = observer.schedulePulse(this.tickCounter)
    if (schedule) {
      this.scheduleEvent(schedule.start, observer.pos)
      this.scheduleEvent(schedule.end, observer.pos)
    }
  }

  getCurrentTick(): number {
    return this.tickCounter
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
        this.updateDustSignal(block)
        changed = oldSignal !== block.signalStrength
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
        const oldState = this.updateBlockPowerState(block)
        changed = oldState !== block.powerState
        break
      }
      case "repeater": {
        const consumeResult = block.tryConsumeSchedule(this.tickCounter)
        if (consumeResult.changed) changed = true
        if (consumeResult.scheduleOff) {
          block.scheduleOutput(this.tickCounter, false)
          this.scheduleEvent(consumeResult.scheduleOff, block.pos)
        }

        const powerChanged = this.updateRepeaterPowerState(block)
        if (powerChanged && !block.locked) {
          if (block.powered) {
            if (!block.outputOn && block.scheduledOutputState !== true) {
              const scheduleTick = block.scheduleOutput(this.tickCounter, true)
              this.scheduleEvent(scheduleTick, block.pos)
            } else if (block.scheduledOutputState === false) {
              block.cancelSchedule()
            }
          } else {
            if (block.outputOn && block.scheduledOutputState !== false) {
              const scheduleTick = block.scheduleOutput(this.tickCounter, false)
              this.scheduleEvent(scheduleTick, block.pos)
            }
          }
        }
        break
      }
      case "torch": {
        if (block.tryConsumeToggle(this.tickCounter)) changed = true

        const shouldSchedule = this.updateTorchState(block)
        if (shouldSchedule && block.scheduledStateChange === null) {
          const scheduleTick = block.scheduleToggle(this.tickCounter)
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
        if (block.tryStartPulse(this.tickCounter)) changed = true
        if (block.tryEndPulse(this.tickCounter)) changed = true
        break
      }
      case "button": {
        if (block.tryRelease(this.tickCounter)) changed = true
        break
      }
      case "pressure-plate": {
        const result = block.tryCheckDeactivation(this.tickCounter)
        if (result.deactivated) changed = true
        if (result.nextCheckTick) this.scheduleEvent(result.nextCheckTick, block.pos)
        break
      }
      case "comparator": {
        if (block.tryConsumeSchedule(this.tickCounter)) changed = true

        const newOutput = this.calculateComparatorInputs(block)
        if (newOutput !== block.outputSignal && block.scheduledOutputChange === null) {
          const scheduleTick = block.scheduleOutput(this.tickCounter, newOutput)
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

      if (block.type === "dust" && block.signalStrength >= 1 && block.isPointingAt(pos)) {
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

  private getBlockPowerState(pos: Vec): PowerState {
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

  private getFullSignalAt(pos: Vec): boolean {
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

  private updateBlockPowerState(block: Solid | Slime): PowerState {
    const oldState = block.powerState

    if (this.receivesStrongPower(block.pos)) {
      block.powerState = "strongly-powered"
    } else if (this.receivesWeakPower(block.pos)) {
      block.powerState = "weakly-powered"
    } else {
      block.powerState = "unpowered"
    }

    return oldState
  }

  calculateDustSignal(dust: Dust): number {
    if (this.getFullSignalAt(dust.pos)) {
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

  private updateDustSignal(dust: Dust): void {
    dust.signalStrength = this.calculateDustSignal(dust)
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

    if (this.getFullSignalAt(backPos)) return true
    if (backBlock && this.outputsTo(backBlock, repeater.pos) > 0) return true

    return false
  }

  private isRepeaterLocked(repeater: Repeater): boolean {
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

  private updateRepeaterPowerState(repeater: Repeater): boolean {
    const wasPowered = repeater.powered
    repeater.powered = this.isRepeaterPowered(repeater)
    repeater.locked = this.isRepeaterLocked(repeater)
    return wasPowered !== repeater.powered
  }

  // COMPARATOR LOGIC
  private calculateComparatorInputs(comparator: Comparator): number {
    const backPos = comparator.pos.add(comparator.facing.neg)
    comparator.rearSignal = this.getSignalStrengthAt(backPos, comparator.pos)

    const sideDirections = comparator.facing.perpendiculars()
    comparator.leftSignal = this.getComparatorSideSignal(comparator.pos, sideDirections[0])
    comparator.rightSignal = this.getComparatorSideSignal(comparator.pos, sideDirections[1])

    return comparator.calculateOutput()
  }

  private getSignalStrengthAt(pos: Vec, towardPos: Vec): number {
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

  private getComparatorSideSignal(comparatorPos: Vec, sideDir: Vec): number {
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
      piston.shortPulse = false
      this.schedulePistonMovement(piston)
    } else if (!shouldActivate && piston.extended && piston.activationTick === null) {
      this.schedulePistonMovement(piston)
    } else if (!shouldActivate && !piston.extended && piston.activationTick !== null) {
      if (this.tickCounter <= piston.activationTick) {
        piston.shortPulse = true
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

    piston.activationTick = null
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
        if (adjPos.add(Y.neg).equals(checkPos) || adjBlock.isPointingAt(checkPos)) {
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

    piston.activationTick = startTick
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
      piston.activationTick = null
      return
    }

    this.executePush(blocksToPush, piston.facing)

    piston.extended = true
    piston.activationTick = null

    this.notifyObserversAt(piston.pos)
    this.triggerBlockUpdate(piston.pos)
  }

  private completePistonRetraction(piston: Piston | StickyPiston): void {
    piston.extended = false
    piston.activationTick = null
    this.notifyObserversAt(piston.pos)

    if (piston.type === "sticky-piston" && !piston.shortPulse) {
      const headPos = piston.pos.add(piston.facing)
      const pullPos = headPos.add(piston.facing)
      const pullBlock = this.getBlock(pullPos)

      if (pullBlock && this.isBlockMovable(pullBlock)) {
        this.setBlock(pullPos, null)
        ;(pullBlock as { pos: Vec }).pos = headPos
        this.setBlock(headPos, pullBlock)
        this.triggerBlockUpdate(pullPos)
        this.triggerBlockUpdate(headPos)

        if (pullBlock.type === "observer") {
          this.triggerObserverPulse(pullBlock)
        }
      }
    }

    piston.shortPulse = false
    this.triggerBlockUpdate(piston.pos)
  }

  private isBlockMovable(block: Block): boolean {
    if (block.type === "solid") return true
    if (block.type === "observer") return true
    if (block.type === "slime") return true
    if ((block.type === "piston" || block.type === "sticky-piston") && !block.extended) return true
    return false
  }

  private findPushableBlocks(piston: Piston | StickyPiston): Vec[] | null {
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

  private isBlockDestroyable(block: Block): boolean {
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
          this.setBlock(newPos, null)
        }

        this.setBlock(pos, null)
        ;(block as { pos: Vec }).pos = newPos
        this.setBlock(newPos, block)

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
