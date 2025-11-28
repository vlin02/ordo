import { describe, test, expect, beforeEach } from "vitest"
import { Engine, Vec, Z } from "@ordo/engine"
import { build, DOOR_POSITIONS, LEVER_POS } from "./solution"

describe("2x2 Flush Piston Door", () => {
  let engine: Engine

  beforeEach(() => {
    engine = new Engine()
    build(engine)
  })

  function isDoorClosed(): boolean {
    return DOOR_POSITIONS.every(pos => {
      const block = engine.getBlock(pos)
      return block?.type === "solid"
    })
  }

  function isDoorOpen(): boolean {
    return DOOR_POSITIONS.every(pos => {
      const block = engine.getBlock(pos)
      return block === null
    })
  }

  function toggleLever(): void {
    engine.interact(LEVER_POS)
  }

  function tickUntil(condition: () => boolean, maxTicks: number): boolean {
    for (let i = 0; i < maxTicks; i++) {
      if (condition()) return true
      engine.tick()
    }
    return condition()
  }

  test("Closed state integrity and visibility", () => {
    // Door starts closed
    expect(isDoorClosed()).toBe(true)

    // Verify 4 solid blocks at doorway
    const doorBlocks = DOOR_POSITIONS.map(pos => engine.getBlock(pos))
    expect(doorBlocks.every(b => b?.type === "solid")).toBe(true)

    // Verify flush alignment (all at same Z plane)
    const zPositions = DOOR_POSITIONS.map(p => p.z)
    expect(new Set(zPositions).size).toBe(1)

    // Check no redstone visible from front (scan 4x4 area centered on door)
    const redstoneTypes = ["piston", "sticky-piston", "dust", "repeater", "comparator", "torch", "redstone-block"]
    for (let x = -1; x <= 2; x++) {
      for (let y = 0; y <= 3; y++) {
        const frontPos = new Vec(x, y, -1)
        const block = engine.getBlock(frontPos)
        if (block) {
          expect(redstoneTypes.includes(block.type)).toBe(false)
        }
      }
    }

    // Verify lever exists
    const lever = engine.getBlock(LEVER_POS)
    expect(lever?.type).toBe("lever")
  })

  test("Single open-close cycle with passage verification", () => {
    // Start closed
    expect(isDoorClosed()).toBe(true)

    // Toggle lever ON
    toggleLever()

    // Wait for door to open (max 30 ticks)
    const opened = tickUntil(isDoorOpen, 30)
    expect(opened).toBe(true)

    // Verify 2x2 passage is clear
    for (const pos of DOOR_POSITIONS) {
      expect(engine.getBlock(pos)).toBe(null)
    }

    // Toggle lever OFF
    toggleLever()

    // Wait for door to close (max 30 ticks)
    const closed = tickUntil(isDoorClosed, 30)
    expect(closed).toBe(true)

    // Verify door blocks returned
    expect(isDoorClosed()).toBe(true)
  })

  test("10-cycle durability", () => {
    // Record initial positions
    expect(isDoorClosed()).toBe(true)

    for (let cycle = 0; cycle < 10; cycle++) {
      // Open
      toggleLever()
      const opened = tickUntil(isDoorOpen, 30)
      expect(opened).toBe(true)

      // Close
      toggleLever()
      const closed = tickUntil(isDoorClosed, 30)
      expect(closed).toBe(true)
    }

    // Verify final state
    expect(isDoorClosed()).toBe(true)
  })

  test("Rapid toggle recovery", () => {
    expect(isDoorClosed()).toBe(true)

    // Toggle ON, wait 5 ticks, toggle OFF
    toggleLever()
    for (let i = 0; i < 5; i++) engine.tick()
    toggleLever()

    // Wait for mechanism to settle
    for (let i = 0; i < 60; i++) engine.tick()

    // Verify door is in valid closed state
    expect(isDoorClosed()).toBe(true)

    // Now open fully
    toggleLever()
    const opened = tickUntil(isDoorOpen, 30)
    expect(opened).toBe(true)

    // Toggle OFF, wait 5 ticks, toggle ON
    toggleLever()
    for (let i = 0; i < 5; i++) engine.tick()
    toggleLever()

    // Wait for settle
    for (let i = 0; i < 60; i++) engine.tick()

    // Verify door is in valid open state
    expect(isDoorOpen()).toBe(true)

    // Close fully
    toggleLever()
    const closed = tickUntil(isDoorClosed, 30)
    expect(closed).toBe(true)
  })

  test("Lever control exclusivity", () => {
    expect(isDoorClosed()).toBe(true)

    // Door remains closed without interaction
    for (let i = 0; i < 20; i++) engine.tick()
    expect(isDoorClosed()).toBe(true)

    // Open door
    toggleLever()
    tickUntil(isDoorOpen, 30)
    expect(isDoorOpen()).toBe(true)

    // Door remains open with lever ON
    for (let i = 0; i < 20; i++) engine.tick()
    expect(isDoorOpen()).toBe(true)

    // Close door
    toggleLever()
    tickUntil(isDoorClosed, 30)
    expect(isDoorClosed()).toBe(true)

    // Door remains closed with lever OFF
    for (let i = 0; i < 20; i++) engine.tick()
    expect(isDoorClosed()).toBe(true)
  })
})

