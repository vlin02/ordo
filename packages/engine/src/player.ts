import type { World } from "./world.js"
import { Vec, X, Y, Z } from "./vec.js"

export type Direction = "+x" | "-x" | "+y" | "-y" | "+z" | "-z"

function dirToVec(dir: Direction): Vec {
  switch (dir) {
    case "+x": return X
    case "-x": return X.neg
    case "+y": return Y
    case "-y": return Y.neg
    case "+z": return Z
    case "-z": return Z.neg
  }
}
import type { Solid } from "./blocks/solid.js"
import type { Slime } from "./blocks/slime.js"
import type { RedstoneBlock } from "./blocks/redstone-block.js"
import type { Dust } from "./blocks/dust.js"
import type { Lever } from "./blocks/lever.js"
import type { Button, ButtonVariant } from "./blocks/button.js"
import type { Torch } from "./blocks/torch.js"
import type { Repeater } from "./blocks/repeater.js"
import type { Comparator, ComparatorMode } from "./blocks/comparator.js"
import type { Piston } from "./blocks/piston.js"
import type { Observer } from "./blocks/observer.js"
import type { PressurePlate, PressurePlateVariant } from "./blocks/pressure-plate.js"
import type { Block } from "./blocks/index.js"

export class Player {
  constructor(readonly world: World) {}

  solid(pos: Vec): Solid {
    this.validateEmpty(pos)
    return this.world.solid(pos)
  }

  slime(pos: Vec): Slime {
    this.validateEmpty(pos)
    return this.world.slime(pos)
  }

  redstoneBlock(pos: Vec): RedstoneBlock {
    this.validateEmpty(pos)
    return this.world.redstoneBlock(pos)
  }

  dust(pos: Vec): Dust {
    this.validateEmpty(pos)
    const block = this.world.dust(pos)
    if (block.shouldDrop()) {
      this.world.removeBlock(block)
      throw new Error(`Cannot place dust at ${pos}: needs solid/slime/piston/observer support below`)
    }
    return block
  }

  lever(pos: Vec, face: Direction): Lever {
    this.validateEmpty(pos)
    const block = this.world.lever(pos, dirToVec(face))
    if (block.shouldDrop()) {
      this.world.removeBlock(block)
      throw new Error(`Cannot place lever at ${pos}: needs solid/piston attachment`)
    }
    return block
  }

  button(pos: Vec, face: Direction, opts?: { variant?: ButtonVariant }): Button {
    this.validateEmpty(pos)
    const block = this.world.button(pos, dirToVec(face), opts)
    if (block.shouldDrop()) {
      this.world.removeBlock(block)
      throw new Error(`Cannot place button at ${pos}: needs solid block attachment`)
    }
    return block
  }

  torch(pos: Vec, face: Direction): Torch {
    this.validateEmpty(pos)
    const block = this.world.torch(pos, dirToVec(face))
    if (block.shouldDrop()) {
      this.world.removeBlock(block)
      throw new Error(`Cannot place torch at ${pos}: needs valid attachment`)
    }
    return block
  }

  repeater(pos: Vec, facing: Direction, opts?: { delay?: 2 | 4 | 6 | 8 }): Repeater {
    this.validateEmpty(pos)
    const block = this.world.repeater(pos, dirToVec(facing), opts)
    if (block.shouldDrop()) {
      this.world.removeBlock(block)
      throw new Error(`Cannot place repeater at ${pos}: needs solid/slime block below`)
    }
    return block
  }

  comparator(pos: Vec, facing: Direction, opts?: { mode?: ComparatorMode }): Comparator {
    this.validateEmpty(pos)
    const block = this.world.comparator(pos, dirToVec(facing), opts)
    if (block.shouldDrop()) {
      this.world.removeBlock(block)
      throw new Error(`Cannot place comparator at ${pos}: needs solid/slime block below`)
    }
    return block
  }

  piston(pos: Vec, facing: Direction): Piston {
    this.validateEmpty(pos)
    return this.world.piston(pos, dirToVec(facing))
  }

  stickyPiston(pos: Vec, facing: Direction): Piston {
    this.validateEmpty(pos)
    return this.world.stickyPiston(pos, dirToVec(facing))
  }

  observer(pos: Vec, facing: Direction): Observer {
    this.validateEmpty(pos)
    return this.world.observer(pos, dirToVec(facing))
  }

  pressurePlate(pos: Vec, opts?: { variant?: PressurePlateVariant }): PressurePlate {
    this.validateEmpty(pos)
    const block = this.world.pressurePlate(pos, opts)
    if (block.shouldDrop()) {
      this.world.removeBlock(block)
      throw new Error(`Cannot place pressure plate at ${pos}: needs solid block below`)
    }
    return block
  }

  interact(block: Lever | Dust | Repeater | Button | Comparator): void {
    this.world.interact(block)
  }

  removeBlock(block: Block): void {
    this.world.removeBlock(block)
  }

  private validateEmpty(pos: Vec): void {
    const existing = this.world.getBlock(pos)
    if (existing) {
      throw new Error(`Cannot place block: position ${pos} already occupied by ${existing.type}`)
    }
  }
}

