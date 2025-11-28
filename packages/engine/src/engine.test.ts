import { describe, it, expect } from "vitest"
import { Engine } from "./engine.js"
import { Solid } from "./blocks/solid.js"
import { Lever } from "./blocks/lever.js"
import { Dust } from "./blocks/dust.js"
import { Piston } from "./blocks/piston.js"
import { StickyPiston } from "./blocks/sticky-piston.js"
import { Repeater } from "./blocks/repeater.js"
import { Torch } from "./blocks/torch.js"
import { Observer } from "./blocks/observer.js"
import { Button } from "./blocks/button.js"
import { Slime } from "./blocks/slime.js"
import { RedstoneBlock } from "./blocks/redstone-block.js"
import { Comparator } from "./blocks/comparator.js"
import { PressurePlate } from "./blocks/pressure-plate.js"
import { Vec, X, Y, Z } from "./vec.js"

const v = (x: number, y: number, z: number) => new Vec(x, y, z)

const tickN = (engine: Engine, n: number) => {
  for (let i = 0; i < n; i++) engine.tick()
}

describe("Redstone Engine - Happy Path", () => {
  it("should handle complex redstone circuit with lever, dust, repeater, torch, and piston", () => {
    const engine = new Engine()

    // Circuit: Lever → Dust → Repeater → Dust → Torch → Piston → Block
    const leverBase = new Solid(v(0, 0, 0))
    engine.placeBlock(leverBase)
    const lever = new Lever(v(1, 0, 0), X.neg, leverBase.pos)
    engine.placeBlock(lever)

    engine.placeBlock(new Solid(v(2, -1, 0)))
    const dust1 = new Dust(v(2, 0, 0))
    engine.placeBlock(dust1)

    engine.placeBlock(new Solid(v(3, -1, 0)))
    const repeater = new Repeater(v(3, 0, 0), X)
    engine.placeBlock(repeater)

    const torchBase = new Solid(v(4, 0, 0))
    engine.placeBlock(torchBase)

    const torch = new Torch(v(5, 0, 0), X.neg, torchBase.pos)
    engine.placeBlock(torch)

    engine.placeBlock(new Solid(v(6, -1, 0)))
    const piston = new Piston(v(6, 0, 0), X)
    engine.placeBlock(piston)

    const blockToPush = new Solid(v(7, 0, 0))
    engine.placeBlock(blockToPush)

    // Initial state
    expect(lever.on).toBe(false)
    expect(dust1.signalStrength).toBe(0)
    expect(repeater.outputOn).toBe(false)
    expect(torch.lit).toBe(true)

    // Torch powers piston
    expect(piston.extended).toBe(false)
    tickN(engine, 3)
    expect(piston.extended).toBe(true)

    // Block pushed
    expect(engine.getBlock(v(7, 0, 0))).toBe(null)
    expect(engine.getBlock(v(8, 0, 0))).not.toBe(null)

    // Turn on lever
    engine.interact(lever.pos)
    expect(lever.on).toBe(true)
    expect(dust1.signalStrength).toBe(15)
    expect(repeater.powered).toBe(true)
    expect(repeater.outputOn).toBe(false)

    tickN(engine, 2)
    expect(repeater.outputOn).toBe(true)
    expect(torchBase.powerState).toBe("strongly-powered")

    expect(torch.lit).toBe(true)
    tickN(engine, 2)
    expect(torch.lit).toBe(false)

    expect(piston.extended).toBe(true)
    tickN(engine, 3)
    expect(piston.extended).toBe(false)

    // Turn lever off
    engine.interact(lever.pos)
    expect(lever.on).toBe(false)
    expect(dust1.signalStrength).toBe(0)

    tickN(engine, 2)
    expect(repeater.outputOn).toBe(false)

    expect(torch.lit).toBe(false)
    tickN(engine, 2)
    expect(torch.lit).toBe(true)

    expect(piston.extended).toBe(false)
    tickN(engine, 3)
    expect(piston.extended).toBe(true)

    expect(engine.getBlock(v(8, 0, 0))).not.toBe(null)
  })
})

describe("Redstone Engine - Edge Cases", () => {
  it("dust signal decays by 1 per block", () => {
    const engine = new Engine()

    engine.placeBlock(new Solid(v(0, 0, 0)))
    const lever = new Lever(v(1, 0, 0), X.neg, v(0, 0, 0))
    engine.placeBlock(lever)

    engine.placeBlock(new Solid(v(2, -1, 0)))
    const dust1 = new Dust(v(2, 0, 0))
    engine.placeBlock(dust1)

    engine.placeBlock(new Solid(v(3, -1, 0)))
    const dust2 = new Dust(v(3, 0, 0))
    engine.placeBlock(dust2)

    engine.placeBlock(new Solid(v(4, -1, 0)))
    const dust3 = new Dust(v(4, 0, 0))
    engine.placeBlock(dust3)

    engine.interact(lever.pos)

    expect(dust1.signalStrength).toBe(15)
    expect(dust2.signalStrength).toBe(14)
    expect(dust3.signalStrength).toBe(13)
  })

  it("piston respects 12-block push limit", () => {
    const engine = new Engine()

    engine.placeBlock(new Solid(v(0, -1, 0)))
    engine.placeBlock(new Solid(v(1, -1, 0)))
    const piston = new Piston(v(1, 0, 0), X)
    engine.placeBlock(piston)

    for (let i = 2; i <= 13; i++) {
      engine.placeBlock(new Solid(v(i, 0, 0)))
    }

    const leverBase = new Solid(v(0, 0, 0))
    engine.placeBlock(leverBase)
    const lever = new Lever(v(0, 1, 0), Y.neg, leverBase.pos)
    engine.placeBlock(lever)

    engine.interact(lever.pos)
    tickN(engine, 4)
    expect(piston.extended).toBe(true)

    engine.interact(lever.pos)
    tickN(engine, 4)
    expect(piston.extended).toBe(false)

    engine.placeBlock(new Solid(v(2, 0, 0)))
    engine.interact(lever.pos)
    tickN(engine, 4)
    expect(piston.extended).toBe(false) // 13 > 12, fails
  })

  it("piston activates via quasi-connectivity", () => {
    const engine = new Engine()

    engine.placeBlock(new Solid(v(0, -1, 0)))
    const piston = new Piston(v(0, 0, 0), X)
    engine.placeBlock(piston)

    const leverBase = new Solid(v(1, 1, 0))
    engine.placeBlock(leverBase)
    const lever = new Lever(v(0, 1, 0), X, leverBase.pos)
    engine.placeBlock(lever)

    expect(piston.extended).toBe(false)
    engine.interact(lever.pos)
    tickN(engine, 4)
    expect(piston.extended).toBe(true)
  })

  it("blocks drop when support/attachment removed", () => {
    const engine = new Engine()

    const base = new Solid(v(0, 0, 0))
    engine.placeBlock(base)
    const base2 = new Solid(v(2, 0, 0))
    engine.placeBlock(base2)

    const dust = new Dust(v(0, 1, 0))
    engine.placeBlock(dust)
    const repeater = new Repeater(v(2, 1, 0), X)
    engine.placeBlock(repeater)
    const torch = new Torch(v(1, 0, 0), X.neg, base.pos)
    engine.placeBlock(torch)
    const lever = new Lever(v(0, -1, 0), Y, base.pos)
    engine.placeBlock(lever)

    expect(engine.getBlock(dust.pos)).toBe(dust)
    expect(engine.getBlock(repeater.pos)).toBe(repeater)
    expect(engine.getBlock(torch.pos)).toBe(torch)
    expect(engine.getBlock(lever.pos)).toBe(lever)

    engine.removeBlock(base.pos)
    expect(engine.getBlock(dust.pos)).toBe(null)
    expect(engine.getBlock(torch.pos)).toBe(null)
    expect(engine.getBlock(lever.pos)).toBe(null)
    expect(engine.getBlock(repeater.pos)).toBe(repeater)

    engine.removeBlock(base2.pos)
    expect(engine.getBlock(repeater.pos)).toBe(null)
  })

  it("repeater locks when powered from side", () => {
    const engine = new Engine()

    engine.placeBlock(new Solid(v(2, -1, 0)))
    const mainRepeater = new Repeater(v(2, 0, 0), X)
    engine.placeBlock(mainRepeater)

    engine.placeBlock(new Solid(v(2, -1, 1)))
    const lockingRepeater = new Repeater(v(2, 0, 1), Z.neg)
    engine.placeBlock(lockingRepeater)

    const lockLeverBase = new Solid(v(2, 0, 2))
    engine.placeBlock(lockLeverBase)
    const lockLever = new Lever(v(2, 1, 2), Y.neg, lockLeverBase.pos)
    engine.placeBlock(lockLever)

    const mainLeverBase = new Solid(v(0, 0, 0))
    engine.placeBlock(mainLeverBase)
    const mainLever = new Lever(v(1, 0, 0), X.neg, mainLeverBase.pos)
    engine.placeBlock(mainLever)

    engine.interact(lockLever.pos)
    tickN(engine, 3)

    expect(lockingRepeater.outputOn).toBe(true)
    expect(mainRepeater.locked).toBe(true)

    engine.interact(mainLever.pos)
    tickN(engine, 3)

    expect(mainRepeater.powered).toBe(true)
    expect(mainRepeater.outputOn).toBe(false) // Locked
  })

  it("repeater delay cycles through 2,4,6,8", () => {
    const engine = new Engine()

    engine.placeBlock(new Solid(v(0, 0, 0)))
    const repeater = new Repeater(v(0, 1, 0), X)
    engine.placeBlock(repeater)

    expect(repeater.delay).toBe(2)
    engine.interact(repeater.pos)
    expect(repeater.delay).toBe(4)
    engine.interact(repeater.pos)
    expect(repeater.delay).toBe(6)
    engine.interact(repeater.pos)
    expect(repeater.delay).toBe(8)
    engine.interact(repeater.pos)
    expect(repeater.delay).toBe(2)
  })

  it("dust shape toggles between cross and dot", () => {
    const engine = new Engine()

    engine.placeBlock(new Solid(v(0, 0, 0)))
    const dust = new Dust(v(0, 1, 0))
    engine.placeBlock(dust)

    expect(dust.shape).toBe("cross")
    engine.interact(dust.pos)
    expect(dust.shape).toBe("dot")
    engine.interact(dust.pos)
    expect(dust.shape).toBe("cross")
  })

  it("piston destroys non-movable blocks in path", () => {
    const engine = new Engine()

    engine.placeBlock(new Solid(v(0, -1, 0)))
    engine.placeBlock(new Solid(v(1, -1, 0)))
    const piston = new Piston(v(1, 0, 0), X)
    engine.placeBlock(piston)

    engine.placeBlock(new Solid(v(2, -1, 0)))
    const dust = new Dust(v(2, 0, 0))
    engine.placeBlock(dust)

    const leverBase = new Solid(v(0, 0, 0))
    engine.placeBlock(leverBase)
    const lever = new Lever(v(0, 1, 0), Y.neg, leverBase.pos)
    engine.placeBlock(lever)

    engine.interact(lever.pos)
    tickN(engine, 4)

    expect(piston.extended).toBe(true)
    expect(engine.getBlock(dust.pos)).toBe(null)
  })

  it("sticky piston pulls block on retraction", () => {
    const engine = new Engine()

    engine.placeBlock(new Solid(v(0, -1, 0)))
    const stickyPiston = new StickyPiston(v(0, 0, 0), X)
    engine.placeBlock(stickyPiston)

    const blockToPush = new Solid(v(1, 0, 0))
    engine.placeBlock(blockToPush)

    const leverBase = new Solid(v(-1, 0, 0))
    engine.placeBlock(leverBase)
    const lever = new Lever(v(-1, 1, 0), Y.neg, leverBase.pos)
    engine.placeBlock(lever)

    engine.interact(lever.pos)
    tickN(engine, 4)

    expect(stickyPiston.extended).toBe(true)
    expect(engine.getBlock(v(2, 0, 0))).not.toBe(null)
    expect(engine.getBlock(v(1, 0, 0))).toBe(null)

    engine.interact(lever.pos)
    tickN(engine, 4)

    expect(stickyPiston.extended).toBe(false)
    expect(engine.getBlock(v(1, 0, 0))).not.toBe(null)
    expect(engine.getBlock(v(2, 0, 0))).toBe(null)
  })

  it("observer detects change and activates piston at back", () => {
    const engine = new Engine()

    const observer = new Observer(v(0, 0, 0), X)
    engine.placeBlock(observer)

    const solidBehind = new Solid(v(-1, 0, 0))
    engine.placeBlock(solidBehind)

    engine.placeBlock(new Solid(v(-2, -1, 0)))
    const piston = new Piston(v(-2, 0, 0), Z.neg)
    engine.placeBlock(piston)

    // Trigger observer
    const triggerBlock = new Solid(v(1, 0, 0))
    engine.placeBlock(triggerBlock)

    tickN(engine, 2)
    expect(observer.outputOn).toBe(true)
    expect(solidBehind.powerState).toBe("strongly-powered")

    tickN(engine, 3)
    expect(piston.extended).toBe(true)

    tickN(engine, 2)
    expect(observer.outputOn).toBe(false)
    expect(solidBehind.powerState).toBe("unpowered")
  })

  it("observer triggers after being moved by piston and detects property changes", () => {
    const engine = new Engine()

    engine.placeBlock(new Solid(v(0, -1, 0)))
    const piston = new Piston(v(0, 0, 0), X)
    engine.placeBlock(piston)

    const observer = new Observer(v(1, 0, 0), Z)
    engine.placeBlock(observer)

    const leverBase = new Solid(v(-1, 0, 0))
    engine.placeBlock(leverBase)
    const lever = new Lever(v(-1, 1, 0), Y.neg, leverBase.pos)
    engine.placeBlock(lever)

    engine.interact(lever.pos)
    tickN(engine, 4)

    expect(piston.extended).toBe(true)
    expect(engine.getBlock(v(2, 0, 0))?.type).toBe("observer")

    tickN(engine, 2)
    expect(observer.outputOn).toBe(true)

    // Also test property change detection
    const engine2 = new Engine()
    const obs2 = new Observer(v(0, 0, 0), X)
    engine2.placeBlock(obs2)

    engine2.placeBlock(new Solid(v(1, -1, 0)))
    const lever2 = new Lever(v(1, 0, 0), Y.neg, v(1, -1, 0))
    engine2.placeBlock(lever2)

    engine2.interact(lever2.pos)
    tickN(engine2, 2)
    expect(obs2.outputOn).toBe(true)
  })

  it("dust dot shape only powers block beneath", () => {
    const engine = new Engine()

    engine.placeBlock(new Solid(v(0, -1, 0)))
    const dust = new Dust(v(0, 0, 0))
    engine.placeBlock(dust)

    const adjacentSolid = new Solid(v(1, 0, 0))
    engine.placeBlock(adjacentSolid)

    const leverBase = new Solid(v(0, 0, 1))
    engine.placeBlock(leverBase)
    const lever = new Lever(v(0, 1, 1), Y.neg, leverBase.pos)
    engine.placeBlock(lever)

    engine.interact(dust.pos)
    expect(dust.shape).toBe("dot")

    engine.interact(lever.pos)
    expect(dust.signalStrength).toBe(15)
    expect(adjacentSolid.powerState).toBe("unpowered")
  })

  it("piston fails to push extended piston", () => {
    const engine = new Engine()

    engine.placeBlock(new Solid(v(0, -1, 0)))
    const piston1 = new Piston(v(0, 0, 0), X)
    engine.placeBlock(piston1)

    engine.placeBlock(new Solid(v(1, -1, 0)))
    const piston2 = new Piston(v(1, 0, 0), Z)
    engine.placeBlock(piston2)

    const lever2Base = new Solid(v(1, 0, -1))
    engine.placeBlock(lever2Base)
    const lever2 = new Lever(v(1, 1, -1), Y.neg, lever2Base.pos)
    engine.placeBlock(lever2)

    engine.interact(lever2.pos)
    tickN(engine, 4)
    expect(piston2.extended).toBe(true)

    const lever1Base = new Solid(v(-1, 0, 0))
    engine.placeBlock(lever1Base)
    const lever1 = new Lever(v(-1, 1, 0), Y.neg, lever1Base.pos)
    engine.placeBlock(lever1)

    engine.interact(lever1.pos)
    tickN(engine, 4)
    expect(piston1.extended).toBe(false)
  })

  it("torch burns out after >8 state changes in 60gt", () => {
    const engine = new Engine()

    const base = new Solid(v(0, 0, 0))
    engine.placeBlock(base)
    const torch = new Torch(v(0, 1, 0), Y.neg, base.pos)
    engine.placeBlock(torch)

    engine.placeBlock(new Solid(v(-1, -1, 0)))
    const repeater = new Repeater(v(-1, 0, 0), X)
    engine.placeBlock(repeater)

    const leverBase = new Solid(v(-2, 0, 0))
    engine.placeBlock(leverBase)
    const lever = new Lever(v(-2, 1, 0), Y.neg, leverBase.pos)
    engine.placeBlock(lever)

    for (let i = 0; i < 9; i++) {
      engine.interact(lever.pos)
      tickN(engine, 4)
      engine.interact(lever.pos)
      tickN(engine, 4)
    }

    expect(torch.lit).toBe(false)
  })

  it("button powers and auto-releases (stone=20gt, wood=30gt)", () => {
    const engine = new Engine()

    const stoneBase = new Solid(v(0, 0, 0))
    engine.placeBlock(stoneBase)
    const stoneButton = new Button(v(1, 0, 0), X.neg, stoneBase.pos, "stone")
    engine.placeBlock(stoneButton)

    engine.interact(stoneButton.pos)
    expect(stoneButton.pressed).toBe(true)
    expect(stoneBase.powerState).toBe("strongly-powered")

    tickN(engine, 20)
    expect(stoneButton.pressed).toBe(false)

    const woodBase = new Solid(v(3, 0, 0))
    engine.placeBlock(woodBase)
    const woodButton = new Button(v(4, 0, 0), X.neg, woodBase.pos, "wood")
    engine.placeBlock(woodButton)

    engine.interact(woodButton.pos)
    expect(woodButton.pressed).toBe(true)

    tickN(engine, 20)
    expect(woodButton.pressed).toBe(true) // Still pressed

    tickN(engine, 10)
    expect(woodButton.pressed).toBe(false) // Released at 30gt
  })

  it("slime block push/pull and conductivity", () => {
    const engine = new Engine()

    engine.placeBlock(new Solid(v(0, -1, 0)))
    const stickyPiston = new StickyPiston(v(0, 0, 0), X)
    engine.placeBlock(stickyPiston)

    const slime = new Slime(v(1, 0, 0))
    engine.placeBlock(slime)

    const leverBase = new Solid(v(-1, 0, 0))
    engine.placeBlock(leverBase)
    const lever = new Lever(v(-1, 1, 0), Y.neg, leverBase.pos)
    engine.placeBlock(lever)

    engine.interact(lever.pos)
    tickN(engine, 4)

    expect(engine.getBlock(v(2, 0, 0))?.type).toBe("slime")
    expect(engine.getBlock(v(1, 0, 0))).toBe(null)

    engine.interact(lever.pos)
    tickN(engine, 4)
    expect(engine.getBlock(v(1, 0, 0))?.type).toBe("slime")

    // Test conductivity
    const engine2 = new Engine()
    engine2.placeBlock(new Solid(v(-1, -1, 0)))
    const rep = new Repeater(v(-1, 0, 0), X)
    engine2.placeBlock(rep)

    const slime2 = new Slime(v(0, 0, 0))
    engine2.placeBlock(slime2)
    const torch = new Torch(v(0, 1, 0), Y.neg, slime2.pos)
    engine2.placeBlock(torch)

    const lb = new Solid(v(-2, 0, 0))
    engine2.placeBlock(lb)
    const lv = new Lever(v(-2, 1, 0), Y.neg, lb.pos)
    engine2.placeBlock(lv)

    engine2.interact(lv.pos)
    tickN(engine2, 6)
    expect(slime2.powerState).toBe("strongly-powered")
    expect(torch.lit).toBe(false)
  })

  it("slime block moves adjacent blocks together and supports dust/repeater", () => {
    const engine = new Engine()

    engine.placeBlock(new Solid(v(0, -1, 0)))
    const piston = new Piston(v(0, 0, 0), X)
    engine.placeBlock(piston)

    const slime = new Slime(v(1, 0, 0))
    engine.placeBlock(slime)
    const attached1 = new Solid(v(1, 1, 0))
    engine.placeBlock(attached1)
    const attached2 = new Solid(v(1, 0, 1))
    engine.placeBlock(attached2)

    const leverBase = new Solid(v(-1, 0, 0))
    engine.placeBlock(leverBase)
    const lever = new Lever(v(-1, 1, 0), Y.neg, leverBase.pos)
    engine.placeBlock(lever)

    engine.interact(lever.pos)
    tickN(engine, 4)

    expect(engine.getBlock(v(2, 0, 0))?.type).toBe("slime")
    expect(engine.getBlock(v(2, 1, 0))?.type).toBe("solid")
    expect(engine.getBlock(v(2, 0, 1))?.type).toBe("solid")
    expect(engine.getBlock(v(1, 0, 0))).toBe(null)
    expect(engine.getBlock(v(1, 1, 0))).toBe(null)
    expect(engine.getBlock(v(1, 0, 1))).toBe(null)

    // Test support
    const engine2 = new Engine()
    const slime2 = new Slime(v(0, 0, 0))
    engine2.placeBlock(slime2)
    const dust = new Dust(v(0, 1, 0))
    engine2.placeBlock(dust)
    engine2.placeBlock(new Slime(v(1, 0, 0)))
    const repeater = new Repeater(v(1, 1, 0), X)
    engine2.placeBlock(repeater)

    expect(engine2.getBlock(dust.pos)).toBe(dust)
    expect(engine2.getBlock(repeater.pos)).toBe(repeater)
  })

  it("comparator modes: comparison and subtraction", () => {
    const engine = new Engine()

    // Comparison: rear >= side → output rear
    engine.placeBlock(new Solid(v(0, -1, 0)))
    const comp1 = new Comparator(v(0, 0, 0), X)
    engine.placeBlock(comp1)
    engine.placeBlock(new RedstoneBlock(v(-1, 0, 0)))
    tickN(engine, 2)
    expect(comp1.outputSignal).toBe(15)

    // Comparison: rear < side → output 0
    engine.placeBlock(new Solid(v(3, -1, 0)))
    const comp2 = new Comparator(v(3, 0, 0), X)
    engine.placeBlock(comp2)
    engine.placeBlock(new RedstoneBlock(v(3, 0, 1)))
    tickN(engine, 2)
    expect(comp2.outputSignal).toBe(0)

    // Subtraction: rear - side
    const engine2 = new Engine()
    engine2.placeBlock(new Solid(v(0, -1, 0)))
    engine2.placeBlock(new RedstoneBlock(v(-1, 0, 0)))
    engine2.placeBlock(new RedstoneBlock(v(0, 0, 1)))
    const comp3 = new Comparator(v(0, 0, 0), X, "subtraction")
    engine2.placeBlock(comp3)
    tickN(engine2, 2)
    expect(comp3.outputSignal).toBe(0) // 15 - 15 = 0
  })

  it("pressure plate variants and strongly powers block beneath", () => {
    const engine = new Engine()

    const variants: Array<["wood" | "stone" | "light_weighted" | "heavy_weighted", number, number]> = [
      ["wood", 1, 15],
      ["light_weighted", 5, 5],
      ["heavy_weighted", 25, 3],
    ]

    variants.forEach(([variant, entityCount, expectedOutput], i) => {
      const base = new Solid(v(i * 2, 0, 0))
      engine.placeBlock(base)
      const plate = new PressurePlate(v(i * 2, 1, 0), variant)
      engine.placeBlock(plate)

      engine.setEntityCount(plate.pos, entityCount)
      expect(plate.active).toBe(true)
      expect(plate.getOutputSignal()).toBe(expectedOutput)
      expect(base.powerState).toBe("strongly-powered")
    })
  })

  it("dust vertical connections: Y+1, Y+1 blocked, Y-1", () => {
    // Y+1 unblocked
    const engine = new Engine()
    engine.placeBlock(new Solid(v(0, 0, 0)))
    const lowerDust = new Dust(v(0, 1, 0))
    engine.placeBlock(lowerDust)
    engine.placeBlock(new Solid(v(1, 1, 0)))
    const upperDust = new Dust(v(1, 2, 0))
    engine.placeBlock(upperDust)

    const leverBase = new Solid(v(2, 2, 0))
    engine.placeBlock(leverBase)
    const lever = new Lever(v(2, 3, 0), Y.neg, leverBase.pos)
    engine.placeBlock(lever)
    engine.interact(lever.pos)

    expect(upperDust.signalStrength).toBe(15)
    expect(lowerDust.signalStrength).toBe(14)

    // Y+1 blocked
    const engine2 = new Engine()
    engine2.placeBlock(new Solid(v(0, 0, 0)))
    const lower2 = new Dust(v(0, 1, 0))
    engine2.placeBlock(lower2)
    engine2.placeBlock(new Solid(v(0, 2, 0))) // Blocker
    engine2.placeBlock(new Solid(v(1, 1, 0)))
    const upper2 = new Dust(v(1, 2, 0))
    engine2.placeBlock(upper2)

    const lb2 = new Solid(v(2, 2, 0))
    engine2.placeBlock(lb2)
    const lv2 = new Lever(v(2, 3, 0), Y.neg, lb2.pos)
    engine2.placeBlock(lv2)
    engine2.interact(lv2.pos)

    expect(upper2.signalStrength).toBe(15)
    expect(lower2.signalStrength).toBe(0) // Blocked

    // Y-1 step down
    const engine3 = new Engine()
    engine3.placeBlock(new Solid(v(0, 1, 0)))
    const upper3 = new Dust(v(0, 2, 0))
    engine3.placeBlock(upper3)
    engine3.placeBlock(new Solid(v(1, 0, 0)))
    const lower3 = new Dust(v(1, 1, 0))
    engine3.placeBlock(lower3)

    const lb3 = new Solid(v(-1, 2, 0))
    engine3.placeBlock(lb3)
    const lv3 = new Lever(v(-1, 3, 0), Y.neg, lb3.pos)
    engine3.placeBlock(lv3)
    engine3.interact(lv3.pos)

    expect(upper3.signalStrength).toBe(15)
    expect(lower3.signalStrength).toBe(14)
  })

  it("piston does not activate from power at front face", () => {
    const engine = new Engine()

    engine.placeBlock(new Solid(v(0, -1, 0)))
    const piston = new Piston(v(0, 0, 0), X)
    engine.placeBlock(piston)

    engine.placeBlock(new RedstoneBlock(v(1, 0, 0)))

    tickN(engine, 4)
    expect(piston.extended).toBe(false)
  })

  it("sticky piston drops block on short pulse", () => {
    const engine = new Engine()

    engine.placeBlock(new Solid(v(0, -1, 0)))
    const stickyPiston = new StickyPiston(v(0, 0, 0), X)
    engine.placeBlock(stickyPiston)

    const block = new Solid(v(1, 0, 0))
    engine.placeBlock(block)

    const leverBase = new Solid(v(-1, 0, 0))
    engine.placeBlock(leverBase)
    const lever = new Lever(v(-1, 1, 0), Y.neg, leverBase.pos)
    engine.placeBlock(lever)

    engine.interact(lever.pos)
    engine.interact(lever.pos) // Immediate off
    engine.tick()

    expect(stickyPiston.extended).toBe(false)
    expect(engine.getBlock(v(2, 0, 0))?.type).toBe("solid")
    expect(engine.getBlock(v(1, 0, 0))).toBe(null)
  })

  it("dust on extended piston base is supported", () => {
    const engine = new Engine()

    engine.placeBlock(new Solid(v(0, -1, 0)))
    const piston = new Piston(v(0, 0, 0), X)
    engine.placeBlock(piston)

    const leverBase = new Solid(v(-1, 0, 0))
    engine.placeBlock(leverBase)
    const lever = new Lever(v(-1, 1, 0), Y.neg, leverBase.pos)
    engine.placeBlock(lever)

    engine.interact(lever.pos)
    tickN(engine, 4)
    expect(piston.extended).toBe(true)

    const dust = new Dust(v(0, 1, 0))
    engine.placeBlock(dust)
    expect(engine.getBlock(dust.pos)).toBe(dust)
  })

  it("repeater extends short input pulse to match delay", () => {
    const engine = new Engine()

    engine.placeBlock(new Solid(v(0, 0, 0)))
    const repeater = new Repeater(v(0, 1, 0), X)
    engine.placeBlock(repeater)
    repeater.delay = 4

    const base = new Solid(v(-1, 1, 0))
    engine.placeBlock(base)
    const button = new Button(v(-1, 1, 1), Z.neg, base.pos)
    engine.placeBlock(button)

    engine.interact(button.pos)
    expect(repeater.powered).toBe(true)

    tickN(engine, 4)
    expect(repeater.outputOn).toBe(true)

    tickN(engine, 4)
    expect(repeater.outputOn).toBe(true) // Extended pulse
  })

  it("redstone block powers adjacent components", () => {
    const engine = new Engine()

    const redstoneBlock = new RedstoneBlock(v(0, 0, 0))
    engine.placeBlock(redstoneBlock)

    engine.placeBlock(new Solid(v(1, -1, 0)))
    const dust = new Dust(v(1, 0, 0))
    engine.placeBlock(dust)

    engine.placeBlock(new Solid(v(-1, -1, 0)))
    const piston = new Piston(v(-1, 0, 0), X.neg)
    engine.placeBlock(piston)

    expect(dust.signalStrength).toBe(15)
    tickN(engine, 4)
    expect(piston.extended).toBe(true)

    // Torch on redstone block turns off
    const engine2 = new Engine()
    const rb = new RedstoneBlock(v(0, 0, 0))
    engine2.placeBlock(rb)
    const torch = new Torch(v(0, 1, 0), Y.neg, rb.pos)
    engine2.placeBlock(torch)
    tickN(engine2, 2)
    expect(torch.lit).toBe(false)
  })

  it("observer above lower dust does NOT block upward connection", () => {
    const engine = new Engine()

    engine.placeBlock(new Solid(v(0, 0, 0)))
    const lowerDust = new Dust(v(0, 1, 0))
    engine.placeBlock(lowerDust)

    // Observer above lower dust (should NOT block upward connection)
    engine.placeBlock(new Observer(v(0, 2, 0), Z))

    engine.placeBlock(new Solid(v(1, 1, 0)))
    const upperDust = new Dust(v(1, 2, 0))
    engine.placeBlock(upperDust)

    const leverBase = new Solid(v(2, 2, 0))
    engine.placeBlock(leverBase)
    const lever = new Lever(v(2, 3, 0), Y.neg, leverBase.pos)
    engine.placeBlock(lever)

    engine.interact(lever.pos)

    expect(upperDust.signalStrength).toBe(15)
    expect(lowerDust.signalStrength).toBe(14) // Observer does NOT block upward
  })

  it("redstone block does NOT power adjacent solid blocks", () => {
    const engine = new Engine()

    const redstoneBlock = new RedstoneBlock(v(0, 0, 0))
    engine.placeBlock(redstoneBlock)

    const adjacentSolid = new Solid(v(1, 0, 0))
    engine.placeBlock(adjacentSolid)

    expect(adjacentSolid.powerState).toBe("unpowered")
  })

  it("comparator mode toggles via interact", () => {
    const engine = new Engine()

    engine.placeBlock(new Solid(v(0, -1, 0)))
    const comp = new Comparator(v(0, 0, 0), X)
    engine.placeBlock(comp)

    expect(comp.mode).toBe("comparison")
    engine.interact(comp.pos)
    expect(comp.mode).toBe("subtraction")
    engine.interact(comp.pos)
    expect(comp.mode).toBe("comparison")
  })

  it("comparator responds to 2gt pulse from observer", () => {
    const engine = new Engine()

    engine.placeBlock(new Solid(v(0, -1, 0)))
    const comparator = new Comparator(v(0, 0, 0), X)
    engine.placeBlock(comparator)

    // Observer facing -x, so back outputs toward +x (toward comparator)
    const observer = new Observer(v(-1, 0, 0), X.neg)
    engine.placeBlock(observer)

    // Trigger observer with block at its front
    engine.placeBlock(new Solid(v(-2, 0, 0)))

    tickN(engine, 2) // Observer starts pulse
    expect(observer.outputOn).toBe(true)

    tickN(engine, 2) // Comparator outputs
    expect(comparator.outputSignal).toBe(15)
  })
})
