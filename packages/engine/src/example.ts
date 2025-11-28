import { Engine, Vec, Y, Solid, Lever, Dust, Repeater, Piston, snapshotToUrl } from "./index.js"

const engine = new Engine()

// Floor
for (let x = 0; x < 6; x++) {
  engine.placeBlock(new Solid(new Vec(x, -1, 0)))
}

// Lever → Dust → Repeater → Piston → Target
engine.placeBlock(new Lever(new Vec(0, 0, 0), Y.neg, new Vec(0, -1, 0)))
engine.placeBlock(new Dust(new Vec(1, 0, 0)))
engine.placeBlock(new Dust(new Vec(2, 0, 0)))
engine.placeBlock(new Repeater(new Vec(3, 0, 0), new Vec(1, 0, 0)))
engine.placeBlock(new Piston(new Vec(4, 0, 0), new Vec(1, 0, 0)))
engine.placeBlock(new Solid(new Vec(5, 0, 0)))

console.log("Initial state:")
console.log("  Tick:", engine.getCurrentTick())
console.log("  Lever on:", engine.getBlock(new Vec(0, 0, 0))?.type === "lever" && (engine.getBlock(new Vec(0, 0, 0)) as any).on)

// Turn on the lever
const lever = engine.getBlock(new Vec(0, 0, 0)) as Lever
engine.interact(lever)
console.log("\nAfter toggling lever:")
console.log("  Lever on:", (engine.getBlock(new Vec(0, 0, 0)) as any).on)
console.log("  Dust signal:", (engine.getBlock(new Vec(1, 0, 0)) as any).signalStrength)

// Wait for repeater delay + piston extension
for (let i = 0; i < 5; i++) {
  engine.tick()
  const repeater = engine.getBlock(new Vec(3, 0, 0)) as any
  const piston = engine.getBlock(new Vec(4, 0, 0)) as any
  console.log(`  Tick ${engine.getCurrentTick()}: repeater.outputOn=${repeater.outputOn}, piston.extended=${piston.extended}`)
}

console.log("\nFinal state:")
const piston = engine.getBlock(new Vec(4, 0, 0)) as any
console.log("  Piston extended:", piston.extended)

// Export URL
const url = snapshotToUrl(engine.toSnapshot(), "http://localhost:5173")
console.log("\nShareable URL:")
console.log(url)
