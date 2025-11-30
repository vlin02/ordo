import { describe, it, expect } from "vitest"
import { World } from "./world.js"
import { Vec, X, Y, Z } from "./vec.js"

const PX = X
const NX = X.neg
const PY = Y
const NY = Y.neg
const PZ = Z
const NZ = Z.neg

const v = (x: number, y: number, z: number) => new Vec(x, y, z)

const tickN = (world: World, n: number) => {
  for (let i = 0; i < n; i++) world.tick()
}

describe("Redstone Engine - Happy Path", () => {
  it("should handle complex redstone circuit with lever, dust, repeater, torch, and piston", () => {
    const world = new World()

    // Circuit: Lever → Dust → Repeater → Dust → Torch → Piston → Block
    const leverBase = world.solid(v(0, 0, 0))
    const lever = world.lever(v(1, 0, 0), NX)

    world.solid(v(2, -1, 0))
    const dust1 = world.dust(v(2, 0, 0))

    world.solid(v(3, -1, 0))
    const repeater = world.repeater(v(3, 0, 0), PX)

    const torchBase = world.solid(v(4, 0, 0))
    const torch = world.torch(v(5, 0, 0), NX)

    world.solid(v(6, -1, 0))
    const piston = world.piston(v(6, 0, 0), PX)

    world.solid(v(7, 0, 0))

    // Initial state
    expect(lever.on).toBe(false)
    expect(dust1.signalStrength).toBe(0)
    expect(repeater.outputOn).toBe(false)
    expect(torch.lit).toBe(true)

    // Torch powers piston
    expect(piston.extended).toBe(false)
    tickN(world, 3)
    expect(piston.extended).toBe(true)

    // Block pushed
    expect(world.getBlock(v(7, 0, 0))).toBe(null)
    expect(world.getBlock(v(8, 0, 0))).not.toBe(null)

    // Turn on lever
    world.interact(lever)
    expect(lever.on).toBe(true)
    expect(dust1.signalStrength).toBe(15)
    expect(repeater.powered).toBe(true)
    expect(repeater.outputOn).toBe(false)

    tickN(world, 2)
    expect(repeater.outputOn).toBe(true)
    expect(torchBase.powerState).toBe("strongly-powered")

    expect(torch.lit).toBe(true)
    tickN(world, 2)
    
    expect(torch.lit).toBe(false)

    expect(piston.extended).toBe(true)
    tickN(world, 3)
    expect(piston.extended).toBe(false)

    // Turn lever off
    world.interact(lever)
    expect(lever.on).toBe(false)
    expect(dust1.signalStrength).toBe(0)

    tickN(world, 2)
    expect(repeater.outputOn).toBe(false)

    expect(torch.lit).toBe(false)
    tickN(world, 2)
    expect(torch.lit).toBe(true)

    expect(piston.extended).toBe(false)
    tickN(world, 3)
    expect(piston.extended).toBe(true)

    expect(world.getBlock(v(8, 0, 0))).not.toBe(null)
  })
})

describe("Redstone Engine - Edge Cases", () => {
  it("dust signal decays by 1 per block", () => {
    const world = new World()

    world.solid(v(0, 0, 0))
    const lever = world.lever(v(1, 0, 0), NX)

    world.solid(v(2, -1, 0))
    const dust1 = world.dust(v(2, 0, 0))

    world.solid(v(3, -1, 0))
    const dust2 = world.dust(v(3, 0, 0))

    world.solid(v(4, -1, 0))
    const dust3 = world.dust(v(4, 0, 0))

    world.interact(lever)

    expect(dust1.signalStrength).toBe(15)
    expect(dust2.signalStrength).toBe(14)
    expect(dust3.signalStrength).toBe(13)
  })

  it("piston respects 12-block push limit", () => {
    const world = new World()

    world.solid(v(0, -1, 0))
    world.solid(v(1, -1, 0))
    const piston = world.piston(v(1, 0, 0), PX)

    for (let i = 2; i <= 13; i++) {
      world.solid(v(i, 0, 0))
    }

    world.solid(v(0, 0, 0))
    const lever = world.lever(v(0, 1, 0), NY)

    world.interact(lever)
    tickN(world, 4)
    expect(piston.extended).toBe(true)

    world.interact(lever)
    tickN(world, 4)
    expect(piston.extended).toBe(false)

    world.solid(v(2, 0, 0))
    world.interact(lever)
    tickN(world, 4)
    expect(piston.extended).toBe(false) // 13 > 12, fails
  })

  it("piston activates via quasi-connectivity", () => {
    const world = new World()

    world.solid(v(0, -1, 0))
    const piston = world.piston(v(0, 0, 0), PX)

    world.solid(v(1, 1, 0))
    const lever = world.lever(v(0, 1, 0), PX)

    expect(piston.extended).toBe(false)
    world.interact(lever)
    tickN(world, 4)
    expect(piston.extended).toBe(true)
  })

  it("blocks drop when support/attachment removed", () => {
    const world = new World()

    const base = world.solid(v(0, 0, 0))
    const base2 = world.solid(v(2, 0, 0))

    const dust = world.dust(v(0, 1, 0))
    const repeater = world.repeater(v(2, 1, 0), PX)
    const torch = world.torch(v(1, 0, 0), NX)
    const lever = world.lever(v(0, -1, 0), PY)

    expect(world.getBlock(dust.pos)).toBe(dust)
    expect(world.getBlock(repeater.pos)).toBe(repeater)
    expect(world.getBlock(torch.pos)).toBe(torch)
    expect(world.getBlock(lever.pos)).toBe(lever)

    world.removeBlock(base)
    expect(world.getBlock(dust.pos)).toBe(null)
    expect(world.getBlock(torch.pos)).toBe(null)
    expect(world.getBlock(lever.pos)).toBe(null)
    expect(world.getBlock(repeater.pos)).toBe(repeater)

    world.removeBlock(base2)
    expect(world.getBlock(repeater.pos)).toBe(null)
  })

  it("repeater locks when powered from side", () => {
    const world = new World()

    world.solid(v(2, -1, 0))
    const mainRepeater = world.repeater(v(2, 0, 0), PX)

    world.solid(v(2, -1, 1))
    const lockingRepeater = world.repeater(v(2, 0, 1), NZ)

    world.solid(v(2, 0, 2))
    const lockLever = world.lever(v(2, 1, 2), NY)

    world.solid(v(0, 0, 0))
    const mainLever = world.lever(v(1, 0, 0), NX)

    world.interact(lockLever)
    tickN(world, 3)

    expect(lockingRepeater.outputOn).toBe(true)
    expect(mainRepeater.locked).toBe(true)

    world.interact(mainLever)
    tickN(world, 3)

    expect(mainRepeater.powered).toBe(true)
    expect(mainRepeater.outputOn).toBe(false) // Locked
  })

  it("repeater delay cycles through 2,4,6,8", () => {
    const world = new World()

    world.solid(v(0, 0, 0))
    const repeater = world.repeater(v(0, 1, 0), PX)

    expect(repeater.delay).toBe(2)
    world.interact(repeater)
    expect(repeater.delay).toBe(4)
    world.interact(repeater)
    expect(repeater.delay).toBe(6)
    world.interact(repeater)
    expect(repeater.delay).toBe(8)
    world.interact(repeater)
    expect(repeater.delay).toBe(2)
  })

  it("dust shape toggles between cross and dot", () => {
    const world = new World()

    world.solid(v(0, 0, 0))
    const dust = world.dust(v(0, 1, 0))

    expect(dust.shape).toBe("cross")
    world.interact(dust)
    expect(dust.shape).toBe("dot")
    world.interact(dust)
    expect(dust.shape).toBe("cross")
  })

  it("piston destroys non-movable blocks in path", () => {
    const world = new World()

    world.solid(v(0, -1, 0))
    world.solid(v(1, -1, 0))
    const piston = world.piston(v(1, 0, 0), PX)

    world.solid(v(2, -1, 0))
    const dust = world.dust(v(2, 0, 0))

    world.solid(v(0, 0, 0))
    const lever = world.lever(v(0, 1, 0), NY)

    world.interact(lever)
    tickN(world, 4)

    expect(piston.extended).toBe(true)
    expect(world.getBlock(dust.pos)).toBe(null)
  })

  it("sticky piston pulls block on retraction", () => {
    const world = new World()

    world.solid(v(0, -1, 0))
    const stickyPiston = world.stickyPiston(v(0, 0, 0), PX)

    world.solid(v(1, 0, 0))

    world.solid(v(-1, 0, 0))
    const lever = world.lever(v(-1, 1, 0), NY)

    world.interact(lever)
    tickN(world, 4)

    expect(stickyPiston.extended).toBe(true)
    expect(world.getBlock(v(2, 0, 0))).not.toBe(null)
    expect(world.getBlock(v(1, 0, 0))).toBe(null)

    world.interact(lever)
    tickN(world, 4)

    expect(stickyPiston.extended).toBe(false)
    expect(world.getBlock(v(1, 0, 0))).not.toBe(null)
    expect(world.getBlock(v(2, 0, 0))).toBe(null)
  })

  it("observer: detects changes, powers back, triggers after piston move", () => {
    // Block placement triggers observer
    const world = new World()
    const observer = world.observer(v(0, 0, 0), PX)
    const solidBehind = world.solid(v(-1, 0, 0))
    world.solid(v(-2, -1, 0))
    const piston = world.piston(v(-2, 0, 0), NZ)

    world.solid(v(1, 0, 0)) // Trigger
    tickN(world, 2)
    expect(observer.outputOn).toBe(true)
    expect(solidBehind.powerState).toBe("strongly-powered")
    tickN(world, 3)
    expect(piston.extended).toBe(true)
    tickN(world, 2)
    expect(observer.outputOn).toBe(false)

    // Triggers after being moved by piston
    const world2 = new World()
    world2.solid(v(0, -1, 0))
    const piston2 = world2.piston(v(0, 0, 0), PX)
    const obs2 = world2.observer(v(1, 0, 0), PZ)
    world2.solid(v(-1, 0, 0))
    const lever2 = world2.lever(v(-1, 1, 0), NY)
    world2.interact(lever2)
    tickN(world2, 4)
    expect(world2.getBlock(v(2, 0, 0))?.type).toBe("observer")
    tickN(world2, 2)
    expect(obs2.outputOn).toBe(true)

    // Property change detection (lever toggle)
    const world3 = new World()
    const obs3 = world3.observer(v(0, 0, 0), PX)
    world3.solid(v(1, -1, 0))
    const lever3 = world3.lever(v(1, 0, 0), NY)
    world3.interact(lever3)
    tickN(world3, 2)
    expect(obs3.outputOn).toBe(true)
  })

  it("dust dot shape only powers block beneath", () => {
    const world = new World()

    world.solid(v(0, -1, 0))
    const dust = world.dust(v(0, 0, 0))

    const adjacentSolid = world.solid(v(1, 0, 0))

    world.solid(v(0, 0, 1))
    const lever = world.lever(v(0, 1, 1), NY)

    world.interact(dust)
    expect(dust.shape).toBe("dot")

    world.interact(lever)
    expect(dust.signalStrength).toBe(15)
    expect(adjacentSolid.powerState).toBe("unpowered")
  })

  it("dust line shape only points in connected directions", () => {
    const world = new World()

    // E-W dust line: dust1 -- dust2 -- dust3
    world.solid(v(-1, -1, 0))
    world.solid(v(0, -1, 0))
    world.solid(v(1, -1, 0))
    const dust1 = world.dust(v(-1, 0, 0))
    const dust2 = world.dust(v(0, 0, 0))
    const dust3 = world.dust(v(1, 0, 0))

    // Piston to the North of dust2 (not in line direction)
    world.solid(v(0, -1, -1))
    const piston = world.piston(v(0, 0, -1), PY)

    // Power the line via lever on dust1
    world.solid(v(-2, 0, 0))
    const lever = world.lever(v(-2, 1, 0), NY)

    world.interact(lever)
    expect(dust2.signalStrength).toBe(14)

    // Piston should NOT activate - dust2 only points E-W, not North
    tickN(world, 4)
    expect(piston.extended).toBe(false)
  })

  it("piston fails to push extended piston", () => {
    const world = new World()

    world.solid(v(0, -1, 0))
    const piston1 = world.piston(v(0, 0, 0), PX)

    world.solid(v(1, -1, 0))
    const piston2 = world.piston(v(1, 0, 0), PZ)

    world.solid(v(1, 0, -1))
    const lever2 = world.lever(v(1, 1, -1), NY)

    world.interact(lever2)
    tickN(world, 4)
    expect(piston2.extended).toBe(true)

    world.solid(v(-1, 0, 0))
    const lever1 = world.lever(v(-1, 1, 0), NY)

    world.interact(lever1)
    tickN(world, 4)
    expect(piston1.extended).toBe(false)
  })

  it("torch burns out after >8 state changes in 60gt", () => {
    const world = new World()

    const base = world.solid(v(0, 0, 0))
    const torch = world.torch(v(0, 1, 0), NY)

    world.solid(v(-1, -1, 0))
    const repeater = world.repeater(v(-1, 0, 0), PX)

    world.solid(v(-2, 0, 0))
    const lever = world.lever(v(-2, 1, 0), NY)

    for (let i = 0; i < 9; i++) {
      world.interact(lever)
      tickN(world, 4)
      world.interact(lever)
      tickN(world, 4)
    }

    expect(torch.lit).toBe(false)
  })

  it("button powers and auto-releases (stone=20gt, wood=30gt)", () => {
    const world = new World()

    const stoneBase = world.solid(v(0, 0, 0))
    const stoneButton = world.button(v(1, 0, 0), NX, { variant: "stone" })

    world.interact(stoneButton)
    expect(stoneButton.pressed).toBe(true)
    expect(stoneBase.powerState).toBe("strongly-powered")

    tickN(world, 20)
    expect(stoneButton.pressed).toBe(false)

    const woodBase = world.solid(v(3, 0, 0))
    const woodButton = world.button(v(4, 0, 0), NX, { variant: "wood" })

    world.interact(woodButton)
    expect(woodButton.pressed).toBe(true)

    tickN(world, 20)
    expect(woodButton.pressed).toBe(true) // Still pressed

    tickN(world, 10)
    expect(woodButton.pressed).toBe(false) // Released at 30gt
  })

  it("slime block: push/pull, stickiness, conductivity, dust not supported", () => {
    // Push/pull
    const world = new World()
    world.solid(v(0, -1, 0))
    const stickyPiston = world.stickyPiston(v(0, 0, 0), PX)
    world.slime(v(1, 0, 0))
    world.solid(v(-1, 0, 0))
    const lever = world.lever(v(-1, 1, 0), NY)

    world.interact(lever)
    tickN(world, 4)
    expect(world.getBlock(v(2, 0, 0))?.type).toBe("slime")

    world.interact(lever)
    tickN(world, 4)
    expect(world.getBlock(v(1, 0, 0))?.type).toBe("slime")

    // Stickiness: adjacent blocks move together
    const world2 = new World()
    world2.solid(v(0, -1, 0))
    world2.piston(v(0, 0, 0), PX)
    world2.slime(v(1, 0, 0))
    world2.solid(v(1, 1, 0))
    world2.solid(v(1, 0, 1))
    world2.solid(v(-1, 0, 0))
    const lever2 = world2.lever(v(-1, 1, 0), NY)

    world2.interact(lever2)
    tickN(world2, 4)
    expect(world2.getBlock(v(2, 0, 0))?.type).toBe("slime")
    expect(world2.getBlock(v(2, 1, 0))?.type).toBe("solid")
    expect(world2.getBlock(v(2, 0, 1))?.type).toBe("solid")

    // Conductivity: torch turns off on strongly-powered slime
    const world3 = new World()
    world3.solid(v(-1, -1, 0))
    world3.repeater(v(-1, 0, 0), PX)
    const slime3 = world3.slime(v(0, 0, 0))
    const torch = world3.torch(v(0, 1, 0), NY)
    world3.solid(v(-2, 0, 0))
    const lv3 = world3.lever(v(-2, 1, 0), NY)
    world3.interact(lv3)
    tickN(world3, 6)
    expect(slime3.powerState).toBe("strongly-powered")
    expect(torch.lit).toBe(false)

    // Conductive blocks (solid, slime) support dust
    const world4 = new World()
    world4.slime(v(0, 0, 0))
    const dust = world4.dust(v(0, 1, 0))
    expect(world4.getBlock(dust.pos)).toBe(dust)

    // Repeater also supported on slime
    world4.slime(v(1, 0, 0))
    const repeater = world4.repeater(v(1, 1, 0), PX)
    expect(world4.getBlock(repeater.pos)).toBe(repeater)
  })

  it("comparator: comparison/subtraction modes, mode toggle, observer input", () => {
    // Comparison: rear >= side → output rear
    const world = new World()
    world.solid(v(0, -1, 0))
    const comp1 = world.comparator(v(0, 0, 0), PX)
    world.redstoneBlock(v(-1, 0, 0))
    tickN(world, 2)
    expect(comp1.outputSignal).toBe(15)

    // Comparison: rear < side → output 0
    world.solid(v(3, -1, 0))
    const comp2 = world.comparator(v(3, 0, 0), PX)
    world.redstoneBlock(v(3, 0, 1))
    tickN(world, 2)
    expect(comp2.outputSignal).toBe(0)

    // Subtraction: rear - side
    const world2 = new World()
    world2.solid(v(0, -1, 0))
    world2.redstoneBlock(v(-1, 0, 0))
    world2.redstoneBlock(v(0, 0, 1))
    const comp3 = world2.comparator(v(0, 0, 0), PX, { mode: "subtraction" })
    tickN(world2, 2)
    expect(comp3.outputSignal).toBe(0)

    // Mode toggle
    const world3 = new World()
    world3.solid(v(0, -1, 0))
    const comp = world3.comparator(v(0, 0, 0), PX)
    expect(comp.mode).toBe("comparison")
    world3.interact(comp)
    expect(comp.mode).toBe("subtraction")

    // Responds to observer input
    const world4 = new World()
    world4.solid(v(0, -1, 0))
    const comparator = world4.comparator(v(0, 0, 0), PX)
    world4.observer(v(-1, 0, 0), NX)
    world4.solid(v(-2, 0, 0)) // Trigger
    tickN(world4, 4)
    expect(comparator.outputSignal).toBe(15)
  })

  it("pressure plate variants and strongly powers block beneath", () => {
    const world = new World()

    const variants: Array<
      ["wood" | "stone" | "light-weighted" | "heavy-weighted", number, number]
    > = [
      ["wood", 1, 15],
      ["light-weighted", 5, 5],
      ["heavy-weighted", 25, 3],
    ]

    variants.forEach(([variant, entityCount, expectedOutput], i) => {
      const base = world.solid(v(i * 2, 0, 0))
      const plate = world.pressurePlate(v(i * 2, 1, 0), { variant })

      world.setEntityCount(plate, { all: entityCount, mobs: entityCount })
      expect(plate.active).toBe(true)
      expect(plate.getOutputSignal()).toBe(expectedOutput)
      expect(base.powerState).toBe("strongly-powered")
    })
  })

  it("dust vertical connections: Y+1, Y+1 blocked, Y-1", () => {
    // Y+1 unblocked
    const world = new World()
    world.solid(v(0, 0, 0))
    const lowerDust = world.dust(v(0, 1, 0))
    world.solid(v(1, 1, 0))
    const upperDust = world.dust(v(1, 2, 0))

    world.solid(v(2, 2, 0))
    const lever = world.lever(v(2, 3, 0), NY)
    world.interact(lever)

    expect(upperDust.signalStrength).toBe(15)
    expect(lowerDust.signalStrength).toBe(14)

    // Y+1 blocked
    const world2 = new World()
    world2.solid(v(0, 0, 0))
    const lower2 = world2.dust(v(0, 1, 0))
    world2.solid(v(0, 2, 0)) // Blocker
    world2.solid(v(1, 1, 0))
    const upper2 = world2.dust(v(1, 2, 0))

    world2.solid(v(2, 2, 0))
    const lv2 = world2.lever(v(2, 3, 0), NY)
    world2.interact(lv2)

    expect(upper2.signalStrength).toBe(15)
    expect(lower2.signalStrength).toBe(0) // Blocked

    // Y-1 step down
    const world3 = new World()
    world3.solid(v(0, 1, 0))
    const upper3 = world3.dust(v(0, 2, 0))
    world3.solid(v(1, 0, 0))
    const lower3 = world3.dust(v(1, 1, 0))

    world3.solid(v(-1, 2, 0))
    const lv3 = world3.lever(v(-1, 3, 0), NY)
    world3.interact(lv3)

    expect(upper3.signalStrength).toBe(15)
    expect(lower3.signalStrength).toBe(14)
  })

  it("piston does not activate from power at front face", () => {
    const world = new World()

    world.solid(v(0, -1, 0))
    const piston = world.piston(v(0, 0, 0), PX)

    world.redstoneBlock(v(1, 0, 0))

    tickN(world, 4)
    expect(piston.extended).toBe(false)
  })

  it("sticky piston drops block on short pulse", () => {
    const world = new World()

    world.solid(v(0, -1, 0))
    const stickyPiston = world.stickyPiston(v(0, 0, 0), PX)

    world.solid(v(1, 0, 0))

    world.solid(v(-1, 0, 0))
    const lever = world.lever(v(-1, 1, 0), NY)

    world.interact(lever)
    world.interact(lever) // Immediate off
    world.tick()

    expect(stickyPiston.extended).toBe(false)
    expect(world.getBlock(v(2, 0, 0))?.type).toBe("solid")
    expect(world.getBlock(v(1, 0, 0))).toBe(null)
  })

  it("dust on extended piston base drops (not supported)", () => {
    const world = new World()

    world.solid(v(0, -1, 0))
    const piston = world.piston(v(0, 0, 0), PX)

    world.solid(v(-1, 0, 0))
    const lever = world.lever(v(-1, 1, 0), NY)

    world.interact(lever)
    tickN(world, 4)
    expect(piston.extended).toBe(true)

    // Piston does NOT support dust per new spec
    const dust = world.dust(v(0, 1, 0))
    expect(world.getBlock(dust.pos)).toBe(null)
  })

  it("repeater extends short input pulse to match delay", () => {
    const world = new World()

    world.solid(v(0, 0, 0))
    const repeater = world.repeater(v(0, 1, 0), PX, { delay: 4 })

    world.solid(v(-1, 1, 0))
    const button = world.button(v(-1, 1, 1), NZ)

    world.interact(button)
    expect(repeater.powered).toBe(true)

    tickN(world, 4)
    expect(repeater.outputOn).toBe(true)

    tickN(world, 4)
    expect(repeater.outputOn).toBe(true) // Extended pulse
  })

  it("redstone block: powers dust/piston, torch turns off, does NOT power solid", () => {
    const world = new World()
    world.redstoneBlock(v(0, 0, 0))
    world.solid(v(1, -1, 0))
    const dust = world.dust(v(1, 0, 0))
    world.solid(v(-1, -1, 0))
    const piston = world.piston(v(-1, 0, 0), NX)

    expect(dust.signalStrength).toBe(15)
    tickN(world, 4)
    expect(piston.extended).toBe(true)

    // Torch on redstone block turns off
    const world2 = new World()
    world2.redstoneBlock(v(0, 0, 0))
    const torch = world2.torch(v(0, 1, 0), NY)
    tickN(world2, 2)
    expect(torch.lit).toBe(false)

    // Does NOT power adjacent solid
    const world3 = new World()
    world3.redstoneBlock(v(0, 0, 0))
    const solid = world3.solid(v(1, 0, 0))
    expect(solid.powerState).toBe("unpowered")
  })

  it("observer above lower dust does NOT block upward connection", () => {
    const world = new World()
    world.solid(v(0, 0, 0))
    const lowerDust = world.dust(v(0, 1, 0))
    world.observer(v(0, 2, 0), PZ)
    world.solid(v(1, 1, 0))
    const upperDust = world.dust(v(1, 2, 0))
    world.solid(v(2, 2, 0))
    const lever = world.lever(v(2, 3, 0), NY)
    world.interact(lever)

    expect(upperDust.signalStrength).toBe(15)
    expect(lowerDust.signalStrength).toBe(14)
  })

  it("dust connects to redstone block", () => {
    const world = new World()
    world.solid(v(0, -1, 0))
    const dust = world.dust(v(0, 0, 0))
    world.redstoneBlock(v(1, 0, 0))

    // Dust should connect and receive SS=15
    expect(dust.signalStrength).toBe(15)
    expect(dust.isPointingAt(v(1, 0, 0))).toBe(true)
  })

  it("slime block blocks dust step-connections like solid", () => {
    // Slime at P+D blocks step-down (D7 rule 5: block at P+D must NOT be solid/slime)
    const world = new World()
    world.solid(v(0, 1, 0))
    const upperDust = world.dust(v(0, 2, 0))
    world.slime(v(1, 2, 0)) // Slime at P+D blocks step-down connection
    world.solid(v(1, 0, 0))
    const lowerDust = world.dust(v(1, 1, 0))

    world.solid(v(-1, 2, 0))
    const lever = world.lever(v(-1, 3, 0), NY)
    world.interact(lever)

    expect(upperDust.signalStrength).toBe(15)
    expect(lowerDust.signalStrength).toBe(0) // Blocked by slime at (1,2,0)
  })

  it("repeater locks when comparator outputs into side", () => {
    const world = new World()
    world.solid(v(0, -1, 0))
    const mainRepeater = world.repeater(v(0, 0, 0), PX)

    world.solid(v(0, -1, 1))
    const lockingComp = world.comparator(v(0, 0, 1), NZ)
    world.redstoneBlock(v(0, 0, 2)) // Powers comparator

    tickN(world, 2)
    expect(lockingComp.outputSignal).toBe(15)
    expect(mainRepeater.locked).toBe(true)
  })

  it("weighted pressure plate deactivates after 10gt (not 20gt)", () => {
    const world = new World()
    world.solid(v(0, 0, 0))
    const plate = world.pressurePlate(v(0, 1, 0), { variant: "light-weighted" })

    world.setEntityCount(plate, { all: 1, mobs: 1 })
    expect(plate.active).toBe(true)

    world.setEntityCount(plate, { all: 0, mobs: 0 })
    tickN(world, 9)
    expect(plate.active).toBe(true) // Still active at 9gt

    world.tick() // 10gt
    expect(plate.active).toBe(false) // Deactivated at 10gt
  })

  it("torch turned off by weakly-powered block", () => {
    const world = new World()
    const base = world.solid(v(0, 0, 0))
    const torch = world.torch(v(1, 0, 0), NX) // Torch attached to side of base

    // Dust pointing at base weakly powers it
    world.solid(v(-1, -1, 0))
    const dust = world.dust(v(-1, 0, 0)) // Cross shape points all directions including +X toward base
    world.solid(v(-2, 0, 0))
    const lever = world.lever(v(-2, 1, 0), NY)

    world.interact(lever)
    expect(dust.signalStrength).toBe(15)
    expect(base.powerState).toBe("weakly-powered")

    tickN(world, 4)
    expect(torch.lit).toBe(false) // Turned off - weak OR strong power turns off torch
  })

})
