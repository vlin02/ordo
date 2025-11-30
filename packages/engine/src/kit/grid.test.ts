import { describe, it, expect } from "vitest"
import { World } from "../world.js"
import { Vec, X, Y, Z } from "../vec.js"
import { Slice, blockSymbol, parseSymbol } from "./grid.js"

const PX = X
const NX = X.neg
const NY = Y.neg

const v = (x: number, y: number, z: number) => new Vec(x, y, z)

describe("Grid Visualization", () => {
  it("renders and parses all block types in circuit", () => {
    const world = new World()

    // Build circuit with all block types
    world.solid(v(0, 0, 0))
    const lever = world.lever(v(1, 0, 0), NX)
    world.solid(v(2, -1, 0))
    const dust = world.dust(v(2, 0, 0))
    world.solid(v(3, -1, 0))
    const repeater = world.repeater(v(3, 0, 0), PX)
    world.solid(v(4, -1, 0))
    const piston = world.piston(v(4, 0, 0), PX)
    world.solid(v(5, -1, 0))
    const comparator = world.comparator(v(5, 0, 0), PX)
    const observer = world.observer(v(6, 0, 0), PX)
    world.solid(v(7, -1, 0))
    const button = world.button(v(7, 0, 0), NY, { variant: "stone" })
    world.solid(v(8, -1, 0))
    const plate = world.pressurePlate(v(8, 0, 0), { variant: "light-weighted" })
    world.solid(v(9, 0, 0))
    const torch = world.torch(v(10, 0, 0), NX)
    const slime = world.slime(v(11, 0, 0))
    const rblock = world.redstoneBlock(v(12, 0, 0))
    world.solid(v(13, -1, 0))
    const sticky = world.stickyPiston(v(13, 0, 0), PX)

    // Set various states
    lever.on = true
    dust.signalStrength = 14
    repeater.outputOn = true
    repeater.delay = 4
    piston.extended = true
    comparator.rearSignal = 8
    comparator.outputSignal = 8
    observer.outputOn = true
    button.pressed = true
    plate.active = true
    plate.entityCount = 5
    torch.lit = false
    slime.powerState = "strongly-powered"

    // Generate symbols
    expect(blockSymbol(lever, world)).toBe("L←*")
    expect(blockSymbol(dust, world)).toBe("D14─")
    expect(blockSymbol(repeater, world)).toBe("R→2*")
    expect(blockSymbol(piston, world)).toBe("P→*")
    expect(blockSymbol(comparator, world)).toBe("C=→08/08")
    expect(blockSymbol(observer, world)).toBe("O→*")
    expect(blockSymbol(button, world)).toBe("Bs-*")
    expect(blockSymbol(plate, world)).toBe("PPg*05")
    expect(blockSymbol(torch, world)).toBe("T←")
    expect(blockSymbol(slime, world)).toBe("SL^")
    expect(blockSymbol(rblock, world)).toBe("RB")
    // sticky piston near redstone block gets activated
    expect(blockSymbol(sticky, world)).toMatch(/^SP→[*!]?$/)

    // Render slice
    const grid = new Slice(world).render(0, [0, 0], [13, 0])
    expect(grid).toContain("Y=0:")
    expect(grid).toContain("L←*")
    expect(grid).toContain("P→*")

    // Parse round-trip
    expect(parseSymbol("L←*")).toEqual({ type: "lever", attached: "←", on: true })
    expect(parseSymbol("D14─")).toEqual({ type: "dust", signal: 14, shape: "─" })
    expect(parseSymbol("R→2*")).toEqual({ type: "repeater", facing: "→", delay: 2, on: true, locked: false })
    expect(parseSymbol("C=→08/08")).toEqual({ type: "comparator", mode: "cmp", facing: "→", rear: 8, output: 8 })
    expect(parseSymbol("PPg*05")).toEqual({ type: "pressure-plate", variant: "light-weighted", active: true, count: 5 })
    expect(parseSymbol("???")).toEqual({ type: "unknown", raw: "???" })
  })

  it("dust shapes reflect connection patterns", () => {
    const world = new World()

    // Cross (4 connections)
    world.solid(v(0, -1, 0))
    const crossDust = world.dust(v(0, 0, 0))
    world.solid(v(1, -1, 0))
    world.dust(v(1, 0, 0))
    world.solid(v(-1, -1, 0))
    world.dust(v(-1, 0, 0))
    world.solid(v(0, -1, 1))
    world.dust(v(0, 0, 1))
    world.solid(v(0, -1, -1))
    world.dust(v(0, 0, -1))
    expect(blockSymbol(crossDust, world)).toContain("┼")

    // Line E-W (2 connections)
    const world2 = new World()
    world2.solid(v(0, -1, 0))
    const lineDust = world2.dust(v(0, 0, 0))
    world2.solid(v(1, -1, 0))
    world2.dust(v(1, 0, 0))
    world2.solid(v(-1, -1, 0))
    world2.dust(v(-1, 0, 0))
    expect(blockSymbol(lineDust, world2)).toContain("─")

    // Dot (0 connections)
    const world3 = new World()
    world3.solid(v(0, -1, 0))
    const dotDust = world3.dust(v(0, 0, 0))
    dotDust.shape = "dot"
    expect(blockSymbol(dotDust, world3)).toContain("·")
  })
})
