/**
 * Agent - LLM-friendly interface for redstone simulation.
 *
 * Usage:
 *   const agent = createAgent(schematic)
 *   agent.toggle(block)      // interact with lever/button
 *   agent.tick(10)           // advance simulation
 *   agent.showGrid()         // visualize all Y-levels
 *   agent.showCircuit()      // trace power flow
 */

import { World } from "../world.js"
import { Player } from "../player.js"
import { Vec } from "../vec.js"
import { Assembler, type Schematic, type BlockDef } from "./assembler.js"
import { trace } from "./circuit.js"
import { Slice } from "./grid.js"
import type { Block } from "../blocks/index.js"
import type { Lever } from "../blocks/lever.js"
import type { Button } from "../blocks/button.js"
import type { Dust } from "../blocks/dust.js"
import type { Repeater } from "../blocks/repeater.js"
import type { Comparator } from "../blocks/comparator.js"
import type { PressurePlate } from "../blocks/pressure-plate.js"

type InteractableBlock = Lever | Button | Dust | Repeater | Comparator

export function createAgent(schematic: Schematic, offset: Vec = Vec.ZERO): Agent {
  const agent = new Agent()
  agent.assemble(schematic, offset)
  return agent
}

export class Agent {
  #world: World
  #assembled = false
  #slice: Slice
  #blocks = new Map<BlockDef, Block>()

  constructor() {
    this.#world = new World()
    this.#slice = new Slice(this.#world)
  }

  assemble(schematic: Schematic, offset: Vec = Vec.ZERO): { failed: Vec[] } {
    if (this.#assembled) {
      throw new Error("Assembly already complete. Cannot place more blocks.")
    }
    this.#assembled = true
    const player = new Player(this.#world)
    const assembler = new Assembler(player)
    const result = assembler.apply(schematic, offset)
    for (const [def, block] of result.blocks) {
      this.#blocks.set(def, block)
    }
    return { failed: result.failed }
  }

  get<T extends Block = Block>(def: BlockDef): T {
    const block = this.#blocks.get(def)
    if (!block) throw new Error(`No block for def: ${JSON.stringify(def)}`)
    return block as T
  }

  // === Interaction ===

  toggle(block: InteractableBlock): void {
    this.#world.interact(block)
  }

  stepOn(plate: PressurePlate, entityCount: number): void {
    this.#world.setEntityCount(plate, { all: entityCount, mobs: entityCount })
  }

  stepOff(plate: PressurePlate): void {
    this.stepOn(plate, 0)
  }

  // === Simulation ===

  tick(count = 1): void {
    for (let i = 0; i < count; i++) {
      this.#world.tick()
    }
  }

  get currentTick(): number {
    return this.#world.getCurrentTick()
  }

  // === Visualization ===

  /**
   * Show all Y-level slices from bottom to top.
   * Uses the grid symbol format (see grid.ts for legend).
   */
  showGrid(): string {
    const blocks = this.#world.getAllBlocks()
    if (blocks.length === 0) return "(empty world)"

    const yLevels = new Set<number>()
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
    for (const b of blocks) {
      yLevels.add(b.pos.y)
      minX = Math.min(minX, b.pos.x)
      maxX = Math.max(maxX, b.pos.x)
      minZ = Math.min(minZ, b.pos.z)
      maxZ = Math.max(maxZ, b.pos.z)
    }

    const sorted = [...yLevels].sort((a, b) => a - b)
    const slices = sorted.map(y => this.#slice.render(y, [minX, minZ], [maxX, maxZ]))
    return slices.join("\n\n")
  }

  showCircuit(opts: { showInactive?: boolean } = {}): string {
    return trace(this.#world).print(opts)
  }
}
