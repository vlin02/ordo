import type { Block } from "./blocks/index.js"
import type { PowerState } from "./blocks/solid.js"
import type { Vec } from "./vec.js"

export type EngineEvent =
  // === Structural ===
  // A block was added to the grid
  | { type: "structural.block_placed"; block: Block }
  // A block was removed from the grid
  | { type: "structural.block_removed"; pos: Vec }
  // A block was moved (e.g. by piston)
  | { type: "structural.block_moved"; block: Block; from: Vec; to: Vec }

  // === Lever ===
  // Player toggled a lever on/off
  | { type: "lever.toggled"; block: Block; on: boolean }

  // === Button ===
  // Player pressed a button, will release at releaseTick
  | { type: "button.pressed"; block: Block; releaseTick: number }
  // Button released after delay
  | { type: "button.released"; block: Block }

  // === Pressure Plate ===
  // Entity count on plate changed
  | { type: "plate.entities_changed"; block: Block; count: number }
  // Plate activated, will check for deactivation at checkTick
  | { type: "plate.activated"; block: Block; checkTick: number }
  // Plate deactivated (no entities)
  | { type: "plate.deactivated"; block: Block }
  // Deactivation check rescheduled (entities still present)
  | { type: "plate.check_rescheduled"; block: Block; checkTick: number }

  // === Dust ===
  // Dust signal strength changed (0-15)
  | { type: "dust.signal_changed"; block: Block; signal: number }
  // Dust shape changed between cross/dot mode
  | { type: "dust.shape_changed"; block: Block; shape: "cross" | "dot" }

  // === Solid/Slime ===
  // Block power state changed (unpowered/weak/strong)
  | { type: "solid.power_state_changed"; block: Block; state: PowerState }

  // === Repeater ===
  // Player changed repeater delay (1-4 ticks)
  | { type: "repeater.delay_changed"; block: Block; delay: number }
  // Repeater input state changed
  | { type: "repeater.input_changed"; block: Block; powered: boolean; locked: boolean }
  // Output change scheduled for future tick
  | { type: "repeater.output_scheduled"; block: Block; tick: number; state: boolean }
  // Repeater output actually changed
  | { type: "repeater.output_changed"; block: Block; on: boolean }
  // Scheduled output change was cancelled
  | { type: "repeater.schedule_cancelled"; block: Block }

  // === Comparator ===
  // Player changed comparator mode
  | { type: "comparator.mode_changed"; block: Block; mode: "comparison" | "subtraction" }
  // Comparator input signals changed
  | { type: "comparator.inputs_changed"; block: Block; rear: number; left: number; right: number }
  // Output change scheduled for future tick
  | { type: "comparator.output_scheduled"; block: Block; tick: number; signal: number }
  // Comparator output actually changed
  | { type: "comparator.output_changed"; block: Block; signal: number }

  // === Torch ===
  // Torch state change scheduled
  | { type: "torch.scheduled"; block: Block; tick: number }
  // Torch lit/unlit state changed
  | { type: "torch.state_changed"; block: Block; lit: boolean; stateChangeTimes: number[] }
  // Torch burned out from rapid toggling
  | { type: "torch.burnout"; block: Block; stateChangeTimes: number[] }

  // === Piston ===
  // Piston extension/retraction scheduled
  | { type: "piston.scheduled"; block: Block; tick: number }
  // Piston finished extending
  | { type: "piston.extended"; block: Block }
  // Piston finished retracting
  | { type: "piston.retracted"; block: Block }
  // Piston activation aborted (e.g. obstruction)
  | { type: "piston.aborted"; block: Block }
  // Piston received short pulse (0-tick)
  | { type: "piston.short_pulse"; block: Block }

  // === Observer ===
  // Observer pulse scheduled (2gt pulse)
  | { type: "observer.pulse_scheduled"; block: Block; startTick: number; endTick: number }
  // Observer pulse started (output on)
  | { type: "observer.pulse_started"; block: Block }
  // Observer pulse ended (output off)
  | { type: "observer.pulse_ended"; block: Block }

  // === Meta ===
  // A game tick occurred
  | { type: "meta.tick"; tick: number }
