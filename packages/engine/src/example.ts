import { Assembler, type BlockDef, type Schematic } from "./kit/assembler.js"
import { World } from "./world.js"
import { Player } from "./player.js"
import { Vec } from "./vec.js"

// Shorthand helpers
const S: BlockDef = { type: "solid" }
const D: BlockDef = { type: "dust" }

const lever: BlockDef = { type: "lever", face: "+y" }
const button: BlockDef = { type: "button", face: "+y" }
const plate: BlockDef = { type: "pressure-plate" }
const torch: BlockDef = { type: "torch", face: "+y" }
const rblock: BlockDef = { type: "redstone-block" }
const observer: BlockDef = { type: "observer", facing: "+x" }
const repeater: BlockDef = { type: "repeater", facing: "+x" }
const comparator: BlockDef = { type: "comparator", facing: "+x" }

// 3D array: [y][x][z]
const blocks: Schematic = [
  // Y=0: Floor
  [
    [S, S, S, S, S, S, S, S],  // x=0
    [S, S, S, S, S, S, S, S],  // x=1
    [S, S, S, S, S, S, S, S],  // x=2
  ],
  // Y=1: Power sources → dust
  [
    [lever, button, plate, torch, rblock, observer, rblock, rblock],  // x=0
    [D, D, D, D, D, D, repeater, comparator],                         // x=1
    [D, D, D, D, D, D, D, D],                                         // x=2
  ],
]

const world = new World()
const player = new Player(world)
const assembler = new Assembler(player)
assembler.apply(blocks)

// Show what powers the dust at (1,1,4)
const circuit = world.getCircuit()
console.log(circuit.printTo(new Vec(1, 1, 4)))
