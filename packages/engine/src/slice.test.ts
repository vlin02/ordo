import { describe, it, expect } from "vitest"
import { Vec, X, Y } from "./vec.js"
import { Solid } from "./blocks/solid.js"
import { Dust } from "./blocks/dust.js"
import { Lever } from "./blocks/lever.js"
import { Piston } from "./blocks/piston.js"
import { Repeater } from "./blocks/repeater.js"
import { Torch } from "./blocks/torch.js"
import { renderSlice, blockSymbol, blockDetails } from "./slice.js"

const v = (x: number, y: number, z: number) => new Vec(x, y, z)

describe("Slice Visualization", () => {
  it("renders a circuit slice with correct symbols and details", () => {
    // Build a simple circuit at Y=0
    const solid = new Solid(v(0, 0, 0))
    solid.powerState = "strongly-powered"
    
    const dust = new Dust(v(1, 0, 0))
    dust.signalStrength = 14
    
    const repeater = new Repeater(v(2, 0, 0), X)
    repeater.outputOn = true
    repeater.delay = 4
    
    const piston = new Piston(v(3, 0, 0), X)
    piston.extended = true
    
    const lever = new Lever(v(0, 1, 0), Y.neg, v(0, 0, 0))
    lever.on = true
    
    const torch = new Torch(v(1, 1, 0), Y.neg, v(1, 0, 0))
    torch.lit = false
    
    const blocks = [solid, dust, repeater, piston, lever, torch]
    
    // Y=0 slice
    const y0 = renderSlice(blocks, "y", 0)
    expect(y0).toContain("Y=0:")
    expect(y0).toContain("z\\x")
    expect(y0).toContain("S+")      // strongly powered solid
    expect(y0).toContain("D14")     // dust with power 14
    expect(y0).toContain("R→2*")    // repeater: east, delay 2 (4/2), outputting
    expect(y0).toContain("P→+")     // piston: east, extended
    expect(y0).toContain("Details:")
    expect(y0).toContain("[z=0,x=0]")
    
    // Y=1 slice
    const y1 = renderSlice(blocks, "y", 1)
    expect(y1).toContain("Y=1:")
    expect(y1).toContain("L+")      // lever on
    expect(y1).toContain("T-")      // torch unlit
    
    // Empty slice
    expect(renderSlice(blocks, "y", 5)).toBe("Y=5: (empty slice)")
  })

  it("shows different arrows for different slice axes", () => {
    const piston = new Piston(v(0, 0, 0), X)  // facing +X
    
    expect(blockSymbol(piston, "y")).toBe("P→")   // in Y slice, +X is →
    expect(blockSymbol(piston, "x")).toBe("P⊙")   // in X slice, +X is out of screen
    expect(blockSymbol(piston, "z")).toBe("P→")   // in Z slice, +X is →
  })

  it("shows special states: locked repeater, burned torch, activating piston", () => {
    const repeater = new Repeater(v(0, 0, 0), X)
    repeater.locked = true
    expect(blockSymbol(repeater, "y")).toContain("L")
    
    const torch = new Torch(v(1, 0, 0), Y.neg, v(1, -1, 0))
    torch.burnedOut = true
    expect(blockSymbol(torch, "y")).toBe("TX")
    
    const piston = new Piston(v(2, 0, 0), X)
    piston.activationTick = 5
    expect(blockSymbol(piston, "y")).toBe("P→!")
  })
})
