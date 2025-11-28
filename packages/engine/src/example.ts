import { buildContraption, type Contraption, type BlockDef } from "./builder.js"
import { Vec } from "./vec.js"

// Shorthand helpers
const S: BlockDef = { type: "solid" }
const D: BlockDef = { type: "dust" }
const _: BlockDef = null

const lever: BlockDef = { type: "lever", face: "+y" }
const button: BlockDef = { type: "button", face: "+y" }
const plate: BlockDef = { type: "pressure-plate" }
const torch: BlockDef = { type: "torch", face: "+y" }
const rblock: BlockDef = { type: "redstone-block" }
const observer: BlockDef = { type: "observer", facing: "+x" }
const repeater: BlockDef = { type: "repeater", facing: "+x" }
const comparator: BlockDef = { type: "comparator", facing: "+x" }

// Each source powers dust to its right
const powerShowcase: Contraption = {
  width: 3,
  length: 8,
  height: 2,
  slices: [
    // Y=0: Floor (solid blocks for torch/lever/button to attach to)
    [
      [S, S, S],  // z=0: under lever
      [S, S, S],  // z=1: under button
      [S, S, S],  // z=2: under plate
      [S, S, S],  // z=3: under torch
      [S, S, S],  // z=4: under redstone block
      [S, S, S],  // z=5: under observer
      [S, S, S],  // z=6: under repeater (needs input)
      [S, S, S],  // z=7: under comparator
    ],
    // Y=1: Power sources → dust
    [
      [lever, D, D],      // z=0: lever powers dust
      [button, D, D],     // z=1: button powers dust
      [plate, D, D],      // z=2: pressure plate powers dust
      [torch, D, D],      // z=3: torch (lit) powers dust
      [rblock, D, D],     // z=4: redstone block powers dust
      [observer, D, D],   // z=5: observer (pulses on block change)
      [rblock, repeater, D], // z=6: redstone block → repeater → dust
      [rblock, comparator, D], // z=7: redstone block → comparator → dust
    ],
  ],
}

const { engine } = buildContraption(powerShowcase)

// Show what powers the dust at (1,1,4) - has multiple sources
const graph = engine.getPowerGraph()
console.log(graph.printTo(new Vec(1, 1, 4)))
