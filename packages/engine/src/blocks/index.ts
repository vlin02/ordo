export { Solid, type PowerState, type Movability } from "./solid.js"
export { Lever } from "./lever.js"
export { Dust, type DustShape } from "./dust.js"
export { Piston } from "./piston.js"
export { Repeater } from "./repeater.js"
export { Torch } from "./torch.js"
export { Observer } from "./observer.js"
export { Button } from "./button.js"
export { Slime } from "./slime.js"
export { RedstoneBlock } from "./redstone-block.js"
export { PressurePlate, type PressurePlateVariant } from "./pressure-plate.js"
export { Comparator, type ComparatorMode } from "./comparator.js"

import type { Solid } from "./solid.js"
import type { Lever } from "./lever.js"
import type { Dust } from "./dust.js"
import type { Piston } from "./piston.js"
import type { Repeater } from "./repeater.js"
import type { Torch } from "./torch.js"
import type { Observer } from "./observer.js"
import type { Button } from "./button.js"
import type { Slime } from "./slime.js"
import type { RedstoneBlock } from "./redstone-block.js"
import type { PressurePlate } from "./pressure-plate.js"
import type { Comparator } from "./comparator.js"

export type BlockType =
  | "solid"
  | "slime"
  | "lever"
  | "dust"
  | "piston"
  | "sticky-piston"
  | "repeater"
  | "torch"
  | "observer"
  | "button"
  | "redstone-block"
  | "pressure-plate"
  | "comparator"

export type Block =
  | Solid
  | Lever
  | Dust
  | Piston
  | Repeater
  | Torch
  | Observer
  | Button
  | Slime
  | RedstoneBlock
  | PressurePlate
  | Comparator
