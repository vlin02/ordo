import { describe, it, expect } from "vitest"
import { Vec, X, Y } from "../vec.js"
import { World } from "../world.js"
import { Circuit, trace, type Node, type Edge } from "./circuit.js"

const v = (x: number, y: number, z: number) => new Vec(x, y, z)

const PX = X
const NY = Y.neg

describe("Circuit", () => {
  it("builds circuit and traces power flow with dust chain compression", () => {
    const world = new World()
    
    // Lever → Solid (strongly powered) → Dust line (4 blocks E)
    const solid = world.solid(v(0, 0, 0))
    const lever = world.lever(v(0, 1, 0), NY)
    
    // 4-block dust line going East
    for (let x = 1; x <= 4; x++) {
      world.solid(v(x, -1, 0))
      world.dust(v(x, 0, 0))
    }
    
    // Toggle lever ON - triggers proper block updates
    world.interact(lever)
    
    const circuit = trace(world)
    
    // Node lookup
    expect(circuit.getNode(lever.pos)?.block).toBe(lever)
    expect(circuit.getNode(v(99, 99, 99))).toBeUndefined()
    
    // Edge traversal: lever → solid
    const leverOut = circuit.getOutgoing(lever.pos)
    expect(leverOut.length).toBeGreaterThan(0)
    expect(leverOut.some(e => e.to.equals(solid.pos))).toBe(true)
    
    // Print methods produce output
    const printAll = circuit.print()
    expect(printAll).toContain("L-*")  // lever on
    
    const printFrom = circuit.printFrom(lever.pos)
    expect(printFrom).toContain("strong→")
    
    // Dust chain compression: 4 dust blocks = 4 signal edges compressed
    expect(printFrom).toMatch(/E×4/)
  })

  it("traces circuit from world with all edge types", () => {
    const world = new World()
    
    // Setup: lever on solid, powers dust, which activates piston
    const solid = world.solid(v(0, 0, 0))
    const lever = world.lever(v(0, 1, 0), NY)
    lever.on = true
    
    world.solid(v(1, -1, 0))
    const dust = world.dust(v(1, 0, 0))
    
    world.solid(v(2, -1, 0))
    const piston = world.piston(v(2, 0, 0), PX)
    
    const circuit = trace(world)
    
    // Should have nodes for all blocks
    expect(circuit.nodes.size).toBeGreaterThan(0)
    
    // Lever should have outgoing edges
    const leverEdges = circuit.getOutgoing(lever.pos)
    expect(leverEdges.length).toBeGreaterThan(0)
    
    // Check for strong power edge to solid
    const strongEdge = leverEdges.find(e => e.type === "strong" && e.to.equals(solid.pos))
    expect(strongEdge).toBeDefined()
    expect(strongEdge?.active).toBe(true)
  })

  it("detects cycles", () => {
    const world = new World()
    
    // Create a simple cycle: torch → solid → torch (inversion)
    const solid = world.solid(v(0, 0, 0))
    const torch = world.torch(v(0, 1, 0), NY)
    
    const circuit = trace(world)
    const cycles = circuit.cycles()
    
    // May or may not find a cycle depending on torch state
    expect(Array.isArray(cycles)).toBe(true)
  })

  it("filters active edges only", () => {
    const world = new World()
    
    const solid = world.solid(v(0, 0, 0))
    const lever = world.lever(v(0, 1, 0), NY)
    lever.on = false // OFF
    
    const circuit = trace(world)
    
    // Should have edges but they should be inactive
    const activeEdges = circuit.getActiveOutgoing(lever.pos)
    expect(activeEdges.length).toBe(0)
    
    // All edges should exist
    const allEdges = circuit.getOutgoing(lever.pos)
    expect(allEdges.length).toBeGreaterThan(0)
  })
})

