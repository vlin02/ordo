import { describe, it, expect } from "vitest"
import { Vec, X, Y } from "./vec.js"
import { Solid } from "./blocks/solid.js"
import { Dust } from "./blocks/dust.js"
import { Lever } from "./blocks/lever.js"
import { Piston } from "./blocks/piston.js"
import { PowerGraph, describeBlockState, type PowerNode, type PowerEdge } from "./power-graph.js"

const v = (x: number, y: number, z: number) => new Vec(x, y, z)

describe("PowerGraph", () => {
  it("builds graph and traces power flow from lever through dust to piston", () => {
    // Lever → Solid → Dust → Piston
    const lever = new Lever(v(0, 1, 0), Y.neg, v(0, 0, 0))
    lever.on = true
    
    const solid = new Solid(v(0, 0, 0))
    solid.powerState = "strongly-powered"
    
    const dust = new Dust(v(1, 0, 0))
    dust.signalStrength = 15
    
    const piston = new Piston(v(2, 0, 0), X)
    piston.extended = true
    
    const nodes = new Map<string, PowerNode>([
      [lever.pos.toKey(), { pos: lever.pos, block: lever, state: "on=true" }],
      [solid.pos.toKey(), { pos: solid.pos, block: solid, state: "strongly-powered" }],
      [dust.pos.toKey(), { pos: dust.pos, block: dust, state: "SS=15" }],
      [piston.pos.toKey(), { pos: piston.pos, block: piston, state: "ext=true" }],
    ])
    
    const edges: PowerEdge[] = [
      { from: lever.pos, to: solid.pos, type: "strong" },
      { from: solid.pos, to: dust.pos, type: "signal", signalStrength: 15 },
      { from: dust.pos, to: piston.pos, type: "activation" },
    ]
    
    const graph = new PowerGraph(nodes, edges)
    
    // Node lookup
    expect(graph.getNode(lever.pos)?.block).toBe(lever)
    expect(graph.getNode(v(99, 99, 99))).toBeUndefined()
    
    // Edge traversal
    expect(graph.getOutgoing(lever.pos)).toHaveLength(1)
    expect(graph.getOutgoing(lever.pos)[0].to.equals(solid.pos)).toBe(true)
    
    expect(graph.getIncoming(piston.pos)).toHaveLength(1)
    expect(graph.getIncoming(piston.pos)[0].from.equals(dust.pos)).toBe(true)
    
    // Print methods produce output
    const printAll = graph.print()
    expect(printAll).toContain("Power Graph")
    expect(printAll).toContain("Lever")
    
    const printTo = graph.printTo(piston.pos)
    expect(printTo).toContain("Piston")
    expect(printTo).toContain("ACTIVATED")
    expect(printTo).toContain("activation")
    
    const printFrom = graph.printFrom(lever.pos)
    expect(printFrom).toContain("Lever")
    expect(printFrom).toContain("strong")
  })
})

describe("describeBlockState", () => {
  it("describes each block type's key state", () => {
    const lever = new Lever(v(0, 0, 0), Y.neg, v(0, -1, 0))
    lever.on = true
    expect(describeBlockState(lever)).toBe("on=true")
    
    const dust = new Dust(v(0, 0, 0))
    dust.signalStrength = 7
    expect(describeBlockState(dust)).toBe("SS=7")
    
    const solid = new Solid(v(0, 0, 0))
    solid.powerState = "weakly-powered"
    expect(describeBlockState(solid)).toBe("weakly-powered")
    
    const piston = new Piston(v(0, 0, 0), X)
    piston.extended = true
    expect(describeBlockState(piston)).toBe("ext=true")
  })
})

