import { describe, it, expect } from "vitest"
import { World } from "../world.js"
import { Vec, X, Y, Z } from "../vec.js"
import { Slice, blockSymbol, parseSymbol, PATTERNS } from "./grid.js"

const PX = X
const NX = X.neg
const PY = Y
const NY = Y.neg
const PZ = Z
const NZ = Z.neg

const v = (x: number, y: number, z: number) => new Vec(x, y, z)

describe("Grid Visualization - Happy Path", () => {
  it("renders circuit with lever, dust, repeater, piston", () => {
    const world = new World()
    
    // Build circuit: Lever → Dust → Repeater → Piston
    world.solid(v(0, 0, 0))
    const lever = world.lever(v(1, 0, 0), NX)
    
    world.solid(v(2, -1, 0))
    const dust = world.dust(v(2, 0, 0))
    
    world.solid(v(3, -1, 0))
    const repeater = world.repeater(v(3, 0, 0), PX)
    
    world.solid(v(4, -1, 0))
    const piston = world.piston(v(4, 0, 0), PX)
    
    // Set states
    lever.on = true
    dust.signalStrength = 14
    repeater.outputOn = true
    repeater.delay = 4
    piston.extended = true
    
    const grid = new Slice(world).render(0, [0, 0], [4, 0])
    
    expect(grid).toContain("Y=0:")
    expect(grid).toContain("z\\x")
    expect(grid).toContain("L←*")     // lever on, attached to west block
    expect(grid).toContain("D14")     // dust signal 14
    expect(grid).toContain("R→2*")    // repeater east, delay 2, on
    expect(grid).toContain("P→*")     // piston east, extended
  })

  it("symbols are parseable back to state", () => {
    // Round-trip: block → symbol → parsed state
    expect(parseSymbol("S^")).toEqual({ type: "solid", power: "strong" })
    expect(parseSymbol("D08┼")).toEqual({ type: "dust", signal: 8, shape: "┼" })
    expect(parseSymbol("L→*")).toEqual({ type: "lever", attached: "→", on: true })
    expect(parseSymbol("R→2*K")).toEqual({ type: "repeater", facing: "→", delay: 2, on: true, locked: true })
    expect(parseSymbol("C-→12/04")).toEqual({ type: "comparator", mode: "sub", facing: "→", rear: 12, output: 4 })
    expect(parseSymbol("P+*")).toEqual({ type: "piston", facing: "+", state: "extended" })
  })
})

describe("Grid Visualization - Block Symbols", () => {
  it("solid power states", () => {
    const world = new World()
    const solid = world.solid(v(0, 0, 0))
    expect(blockSymbol(solid, world)).toBe("S")
    solid.powerState = "strongly-powered"
    expect(blockSymbol(solid, world)).toBe("S^")
    solid.powerState = "weakly-powered"
    expect(blockSymbol(solid, world)).toBe("S~")
  })

  it("lever attachment and state", () => {
    const world = new World()
    
    world.solid(v(0, 0, 0))
    const leverWall = world.lever(v(1, 0, 0), NX)  // attached to west
    world.solid(v(2, -1, 0))
    const leverFloor = world.lever(v(2, 0, 0), NY)  // attached to floor
    
    expect(blockSymbol(leverWall, world)).toBe("L←")
    leverWall.on = true
    expect(blockSymbol(leverWall, world)).toBe("L←*")
    
    expect(blockSymbol(leverFloor, world)).toBe("L-")
    leverFloor.on = true
    expect(blockSymbol(leverFloor, world)).toBe("L-*")
  })

  it("button variants", () => {
    const world = new World()
    
    const stone = world.button(v(0, 0, 0), NZ, { variant: "stone" })
    const wood = world.button(v(1, 0, 0), NX, { variant: "wood" })
    
    expect(blockSymbol(stone, world)).toBe("Bs↑")  // attached north (-Z)
    stone.pressed = true
    expect(blockSymbol(stone, world)).toBe("Bs↑*")
    
    expect(blockSymbol(wood, world)).toBe("Bw←")  // attached west (-X)
  })

  it("torch states", () => {
    const world = new World()
    
    world.solid(v(0, 0, 0))
    const torch = world.torch(v(1, 0, 0), NX)
    
    
    expect(blockSymbol(torch, world)).toBe("T←*")  // lit by default
    torch.lit = false
    expect(blockSymbol(torch, world)).toBe("T←")
    torch.burnedOut = true
    expect(blockSymbol(torch, world)).toBe("T←x")
  })

  it("pressure plate variants and count", () => {
    const world = new World()
    
    world.solid(v(0, -1, 0))
    const stone = world.pressurePlate(v(0, 0, 0), { variant: "stone" })
    world.solid(v(1, -1, 0))
    const gold = world.pressurePlate(v(1, 0, 0), { variant: "light-weighted" })
    
    
    expect(blockSymbol(stone, world)).toBe("PPs")
    
    gold.active = true
    gold.entityCount = 5
    expect(blockSymbol(gold, world)).toBe("PPg*05")
  })

  it("repeater delay and lock", () => {
    const world = new World()
    
    world.solid(v(0, -1, 0))
    const rep = world.repeater(v(0, 0, 0), PX)
    expect(blockSymbol(rep, world)).toBe("R→1")
    
    rep.outputOn = true
    expect(blockSymbol(rep, world)).toBe("R→1*")
    
    rep.delay = 8
    expect(blockSymbol(rep, world)).toBe("R→4*")
    
    rep.locked = true
    expect(blockSymbol(rep, world)).toBe("R→4*K")
  })

  it("comparator mode and signals", () => {
    const world = new World()
    
    world.solid(v(0, -1, 0))
    const cmp = world.comparator(v(0, 0, 0), PX, { mode: "comparison" })
    world.solid(v(1, -1, 0))
    const sub = world.comparator(v(1, 0, 0), NZ, { mode: "subtraction" })
    
    
    cmp.rearSignal = 8
    cmp.outputSignal = 8
    expect(blockSymbol(cmp, world)).toBe("C=→08/08")
    
    sub.rearSignal = 12
    sub.outputSignal = 4
    expect(blockSymbol(sub, world)).toBe("C-↑12/04")
  })

  it("piston and sticky-piston states", () => {
    const world = new World()
    
    world.solid(v(0, -1, 0))
    const piston = world.piston(v(0, 0, 0), PY)
    expect(blockSymbol(piston, world)).toBe("P+")
    piston.extended = true
    expect(blockSymbol(piston, world)).toBe("P+*")
    
    world.solid(v(1, -1, 0))
    const sticky = world.stickyPiston(v(1, 0, 0), PX)
    expect(blockSymbol(sticky, world)).toBe("SP→")
    sticky.activationTick = 5
    expect(blockSymbol(sticky, world)).toBe("SP→!")
  })

  it("observer facing and pulse", () => {
    const world = new World()
    
    const obs = world.observer(v(0, 0, 0), PZ)
    expect(blockSymbol(obs, world)).toBe("O↓")
    obs.outputOn = true
    expect(blockSymbol(obs, world)).toBe("O↓*")
  })
})

describe("Grid Visualization - Regex Parsing", () => {
  it("patterns match all valid symbols", () => {
    expect(PATTERNS.air.test(".")).toBe(true)
    expect(PATTERNS.solid.test("S")).toBe(true)
    expect(PATTERNS.solid.test("S^")).toBe(true)
    expect(PATTERNS.solid.test("S~")).toBe(true)
    expect(PATTERNS.slime.test("SL")).toBe(true)
    expect(PATTERNS.slime.test("SL^")).toBe(true)
    expect(PATTERNS.redstoneBlock.test("RB")).toBe(true)
    expect(PATTERNS.dust.test("D00·")).toBe(true)
    expect(PATTERNS.dust.test("D15┼")).toBe(true)
    expect(PATTERNS.lever.test("L→")).toBe(true)
    expect(PATTERNS.lever.test("L-*")).toBe(true)
    expect(PATTERNS.button.test("Bs→")).toBe(true)
    expect(PATTERNS.button.test("Bw←*")).toBe(true)
    expect(PATTERNS.torch.test("T-*")).toBe(true)
    expect(PATTERNS.torch.test("T→x")).toBe(true)
    expect(PATTERNS.pressurePlate.test("PPs")).toBe(true)
    expect(PATTERNS.pressurePlate.test("PPg*05")).toBe(true)
    expect(PATTERNS.repeater.test("R→1")).toBe(true)
    expect(PATTERNS.repeater.test("R↑4*K")).toBe(true)
    expect(PATTERNS.comparator.test("C=→08/08")).toBe(true)
    expect(PATTERNS.comparator.test("C-↓15/00")).toBe(true)
    expect(PATTERNS.piston.test("P→")).toBe(true)
    expect(PATTERNS.piston.test("P+*")).toBe(true)
    expect(PATTERNS.piston.test("P-!")).toBe(true)
    expect(PATTERNS.stickyPiston.test("SP→")).toBe(true)
    expect(PATTERNS.stickyPiston.test("SP↑*")).toBe(true)
    expect(PATTERNS.observer.test("O↓")).toBe(true)
    expect(PATTERNS.observer.test("O→*")).toBe(true)
  })

  it("parseSymbol handles all block types", () => {
    expect(parseSymbol(".")).toEqual({ type: "air" })
    expect(parseSymbol("S")).toEqual({ type: "solid", power: undefined })
    expect(parseSymbol("SL~")).toEqual({ type: "slime", power: "weak" })
    expect(parseSymbol("RB")).toEqual({ type: "redstone-block" })
    expect(parseSymbol("D00·")).toEqual({ type: "dust", signal: 0, shape: "·" })
    expect(parseSymbol("Bw↓*")).toEqual({ type: "button", variant: "w", attached: "↓", pressed: true })
    expect(parseSymbol("T+*")).toEqual({ type: "torch", attached: "+", state: "lit" })
    expect(parseSymbol("PPi*12")).toEqual({ type: "pressure-plate", variant: "heavy-weighted", active: true, count: 12 })
    expect(parseSymbol("SP-!")).toEqual({ type: "sticky-piston", facing: "-", state: "activating" })
    expect(parseSymbol("O+*")).toEqual({ type: "observer", facing: "+", pulsing: true })
  })

  it("parseSymbol returns unknown for invalid symbols", () => {
    expect(parseSymbol("???")).toEqual({ type: "unknown", raw: "???" })
    expect(parseSymbol("X")).toEqual({ type: "unknown", raw: "X" })
  })
})
