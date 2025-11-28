import { Vec, type VecObj } from "./vec.js"
import { Solid, type PowerState } from "./blocks/solid.js"
import { Slime } from "./blocks/slime.js"
import { Lever } from "./blocks/lever.js"
import { Dust } from "./blocks/dust.js"
import { Piston } from "./blocks/piston.js"
import { StickyPiston } from "./blocks/sticky-piston.js"
import { Repeater } from "./blocks/repeater.js"
import { Torch } from "./blocks/torch.js"
import { Observer } from "./blocks/observer.js"
import { Button } from "./blocks/button.js"
import { RedstoneBlock } from "./blocks/redstone-block.js"
import { PressurePlate } from "./blocks/pressure-plate.js"
import { Comparator } from "./blocks/comparator.js"
import type { Block } from "./blocks/index.js"

export type { VecObj }

export type BlockState =
  | { type: "solid"; pos: VecObj; powerState: PowerState }
  | { type: "slime"; pos: VecObj; powerState: PowerState }
  | { type: "lever"; pos: VecObj; attachedFace: VecObj; on: boolean }
  | { type: "dust"; pos: VecObj; signalStrength: number; shape: "cross" | "dot" }
  | { type: "piston"; pos: VecObj; facing: VecObj; extended: boolean; activationTick: number | null; shortPulse: boolean }
  | { type: "sticky-piston"; pos: VecObj; facing: VecObj; extended: boolean; activationTick: number | null; shortPulse: boolean }
  | { type: "repeater"; pos: VecObj; facing: VecObj; delay: number; powered: boolean; locked: boolean; outputOn: boolean; scheduledOutputChange: number | null; scheduledOutputState: boolean | null }
  | { type: "torch"; pos: VecObj; attachedFace: VecObj; lit: boolean; scheduledStateChange: number | null; stateChangeTimes: number[]; burnedOut: boolean }
  | { type: "observer"; pos: VecObj; facing: VecObj; outputOn: boolean; scheduledPulseStart: number | null; scheduledPulseEnd: number | null }
  | { type: "button"; pos: VecObj; attachedFace: VecObj; variant: "stone" | "wood"; pressed: boolean; scheduledRelease: number | null }
  | { type: "redstone-block"; pos: VecObj }
  | { type: "pressure-plate"; pos: VecObj; variant: "wood" | "stone" | "light_weighted" | "heavy_weighted"; entityCount: number; active: boolean; scheduledDeactivationCheck: number | null }
  | { type: "comparator"; pos: VecObj; facing: VecObj; mode: "comparison" | "subtraction"; rearSignal: number; leftSignal: number; rightSignal: number; outputSignal: number; scheduledOutputChange: number | null; scheduledOutputSignal: number | null }

export type Snapshot = {
  tickCounter: number
  blocks: BlockState[]
  events: { tick: number; positions: string[] }[]
}

// Encoding
export function encodeSnapshot(snapshot: Snapshot): string {
  return btoa(JSON.stringify(snapshot))
}

export function decodeSnapshot(encoded: string): Snapshot {
  return JSON.parse(atob(encoded)) as Snapshot
}

// URL helpers
export function snapshotToUrl(snapshot: Snapshot, baseUrl: string): string {
  const url = new URL(baseUrl)
  url.searchParams.set("state", encodeSnapshot(snapshot))
  return url.toString()
}

export function snapshotFromUrl(url: string): Snapshot | null {
  const parsed = new URL(url)
  const encoded = parsed.searchParams.get("state")
  if (!encoded) return null
  return decodeSnapshot(encoded)
}

// Block serialization (exported for Engine)
export function serializeBlock(block: Block): BlockState {
  const pos = block.pos.toJSON()

  switch (block.type) {
    case "solid":
      return { type: "solid", pos, powerState: block.powerState }
    case "slime":
      return { type: "slime", pos, powerState: block.powerState }
    case "lever":
      return { type: "lever", pos, attachedFace: block.attachedFace.toJSON(), on: block.on }
    case "dust":
      return { type: "dust", pos, signalStrength: block.signalStrength, shape: block.shape }
    case "piston":
      return { type: "piston", pos, facing: block.facing.toJSON(), extended: block.extended, activationTick: block.activationTick, shortPulse: block.shortPulse }
    case "sticky-piston":
      return { type: "sticky-piston", pos, facing: block.facing.toJSON(), extended: block.extended, activationTick: block.activationTick, shortPulse: block.shortPulse }
    case "repeater":
      return { type: "repeater", pos, facing: block.facing.toJSON(), delay: block.delay, powered: block.powered, locked: block.locked, outputOn: block.outputOn, scheduledOutputChange: block.scheduledOutputChange, scheduledOutputState: block.scheduledOutputState }
    case "torch":
      return { type: "torch", pos, attachedFace: block.attachedFace.toJSON(), lit: block.lit, scheduledStateChange: block.scheduledStateChange, stateChangeTimes: block.stateChangeTimes, burnedOut: block.burnedOut }
    case "observer":
      return { type: "observer", pos, facing: block.facing.toJSON(), outputOn: block.outputOn, scheduledPulseStart: block.scheduledPulseStart, scheduledPulseEnd: block.scheduledPulseEnd }
    case "button":
      return { type: "button", pos, attachedFace: block.attachedFace.toJSON(), variant: block.variant, pressed: block.pressed, scheduledRelease: block.scheduledRelease }
    case "redstone-block":
      return { type: "redstone-block", pos }
    case "pressure-plate":
      return { type: "pressure-plate", pos, variant: block.variant, entityCount: block.entityCount, active: block.active, scheduledDeactivationCheck: block.scheduledDeactivationCheck }
    case "comparator":
      return { type: "comparator", pos, facing: block.facing.toJSON(), mode: block.mode, rearSignal: block.rearSignal, leftSignal: block.leftSignal, rightSignal: block.rightSignal, outputSignal: block.outputSignal, scheduledOutputChange: block.scheduledOutputChange, scheduledOutputSignal: block.scheduledOutputSignal }
  }
}

export function deserializeBlock(state: BlockState): Block {
  const pos = Vec.fromJSON(state.pos)

  switch (state.type) {
    case "solid": {
      const block = new Solid(pos)
      block.powerState = state.powerState
      return block
    }
    case "slime": {
      const block = new Slime(pos)
      block.powerState = state.powerState
      return block
    }
    case "lever": {
      const attachedFace = Vec.fromJSON(state.attachedFace)
      const attachedPos = pos.add(attachedFace)
      const block = new Lever(pos, attachedFace, attachedPos)
      block.on = state.on
      return block
    }
    case "dust": {
      const block = new Dust(pos)
      block.signalStrength = state.signalStrength
      block.shape = state.shape
      return block
    }
    case "piston": {
      const block = new Piston(pos, Vec.fromJSON(state.facing))
      block.extended = state.extended
      block.activationTick = state.activationTick
      block.shortPulse = state.shortPulse
      return block
    }
    case "sticky-piston": {
      const block = new StickyPiston(pos, Vec.fromJSON(state.facing))
      block.extended = state.extended
      block.activationTick = state.activationTick
      block.shortPulse = state.shortPulse
      return block
    }
    case "repeater": {
      const block = new Repeater(pos, Vec.fromJSON(state.facing))
      block.delay = state.delay
      block.powered = state.powered
      block.locked = state.locked
      block.outputOn = state.outputOn
      block.scheduledOutputChange = state.scheduledOutputChange
      block.scheduledOutputState = state.scheduledOutputState
      return block
    }
    case "torch": {
      const attachedFace = Vec.fromJSON(state.attachedFace)
      const attachedPos = pos.add(attachedFace)
      const block = new Torch(pos, attachedFace, attachedPos)
      block.lit = state.lit
      block.scheduledStateChange = state.scheduledStateChange
      block.stateChangeTimes = state.stateChangeTimes
      block.burnedOut = state.burnedOut
      return block
    }
    case "observer": {
      const block = new Observer(pos, Vec.fromJSON(state.facing))
      block.outputOn = state.outputOn
      block.scheduledPulseStart = state.scheduledPulseStart
      block.scheduledPulseEnd = state.scheduledPulseEnd
      return block
    }
    case "button": {
      const attachedFace = Vec.fromJSON(state.attachedFace)
      const attachedPos = pos.add(attachedFace)
      const block = new Button(pos, attachedFace, attachedPos, state.variant)
      block.pressed = state.pressed
      block.scheduledRelease = state.scheduledRelease
      return block
    }
    case "redstone-block":
      return new RedstoneBlock(pos)
    case "pressure-plate": {
      const block = new PressurePlate(pos, state.variant)
      block.entityCount = state.entityCount
      block.active = state.active
      block.scheduledDeactivationCheck = state.scheduledDeactivationCheck
      return block
    }
    case "comparator": {
      const block = new Comparator(pos, Vec.fromJSON(state.facing), state.mode)
      block.rearSignal = state.rearSignal
      block.leftSignal = state.leftSignal
      block.rightSignal = state.rightSignal
      block.outputSignal = state.outputSignal
      block.scheduledOutputChange = state.scheduledOutputChange
      block.scheduledOutputSignal = state.scheduledOutputSignal
      return block
    }
  }
}
