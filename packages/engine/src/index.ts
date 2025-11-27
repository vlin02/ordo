import type { Solid } from "./blocks/solid.js"
import type { Lever } from "./blocks/lever.js"
import type { Dust } from "./blocks/dust.js"
import type { Piston } from "./blocks/piston.js"
import type { StickyPiston } from "./blocks/sticky-piston.js"
import type { Repeater } from "./blocks/repeater.js"
import type { Torch } from "./blocks/torch.js"
import type { Observer } from "./blocks/observer.js"
import type { Button } from "./blocks/button.js"
import type { Slime } from "./blocks/slime.js"
import type { RedstoneBlock } from "./blocks/redstone-block.js"
import type { PressurePlate } from "./blocks/pressure-plate.js"
import type { Comparator } from "./blocks/comparator.js"

export { Engine } from "./engine.js"
export { Solid, type PowerState } from "./blocks/solid.js"
export { Lever } from "./blocks/lever.js"
export { Dust, type DustShape } from "./blocks/dust.js"
export { Piston } from "./blocks/piston.js"
export { StickyPiston } from "./blocks/sticky-piston.js"
export { Repeater } from "./blocks/repeater.js"
export { Torch } from "./blocks/torch.js"
export { Observer } from "./blocks/observer.js"
export { Button } from "./blocks/button.js"
export { Slime } from "./blocks/slime.js"
export { RedstoneBlock } from "./blocks/redstone-block.js"
export { PressurePlate, type PressurePlateVariant } from "./blocks/pressure-plate.js"
export { Comparator, type ComparatorMode } from "./blocks/comparator.js"

export { Vec, X, Y, Z, HORIZONTALS, ALL_DIRECTIONS } from "./vec.js"

export type Block =
  | Solid
  | Lever
  | Dust
  | Piston
  | StickyPiston
  | Repeater
  | Torch
  | Observer
  | Button
  | Slime
  | RedstoneBlock
  | PressurePlate
  | Comparator
