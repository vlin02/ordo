import { Vec } from "../vec.js"

export class RedstoneBlock {
  readonly type = "redstone-block" as const
  readonly pos: Vec

  constructor(pos: Vec) {
    this.pos = pos
  }
}
