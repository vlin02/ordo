/**
 * Slice visualization for redstone debugging.
 *
 * Symbol Reference:
 * | Block        | Symbol              | State Encoding                          |
 * |--------------|---------------------|-----------------------------------------|
 * | Air          | .                   |                                         |
 * | Solid        | S  S+  S~           | unpowered / strongly / weakly powered   |
 * | Slime        | SL  SL+  SL~        | + power state                           |
 * | RedstoneBlock| RB                  | always on                               |
 * | Dust         | D0 - D15            | power level                             |
 * | Lever        | L+  L-              | on / off                                |
 * | Button       | B+  B-              | pressed / not                           |
 * | Torch        | T+  T-  TX          | lit / unlit / burned out                |
 * | PressurePlate| PP+  PP-            | active / inactive                       |
 * | Repeater     | R{dir}{delay}{state}| R→2 R→4* R←1L  (*=on, L=locked)         |
 * | Comparator   | C{mode}{dir}{out}   | C=→ C-↑8  (= compare, - subtract)       |
 * | Piston       | P{dir}{state}       | P→ P↑+ P↓!  (+=extended, !=activating)  |
 * | StickyPiston | Q{dir}{state}       | Q→ Q↑+ Q↓!  (same as piston)            |
 * | Observer     | O{dir}{state}       | O→ O↑*  (*=pulsing)                     |
 *
 * Direction Arrows:
 * | Arrow | Meaning                    |
 * |-------|----------------------------|
 * | →←↑↓  | in-plane directions        |
 * | ⊙     | facing out of screen       |
 * | ⊗     | facing into screen         |
 */

import { Vec } from "./vec.js"
import type { Block } from "./blocks/index.js"

export type SliceAxis = "x" | "y" | "z"

export function renderSlice(blocks: Block[], axis: SliceAxis, value: number): string {
  const filtered = blocks.filter(b => b.pos[axis] === value)
  if (filtered.length === 0) return `${axis.toUpperCase()}=${value}: (empty slice)`

  const [h, v] = axis === "x" ? ["z", "y"] : axis === "y" ? ["x", "z"] : ["x", "y"]

  let minH = Infinity, maxH = -Infinity, minV = Infinity, maxV = -Infinity
  for (const b of filtered) {
    const hVal = b.pos[h as "x" | "y" | "z"]
    const vVal = b.pos[v as "x" | "y" | "z"]
    minH = Math.min(minH, hVal); maxH = Math.max(maxH, hVal)
    minV = Math.min(minV, vVal); maxV = Math.max(maxV, vVal)
  }

  const grid: Map<string, Block> = new Map()
  for (const b of filtered) grid.set(`${b.pos[h as "x" | "y" | "z"]},${b.pos[v as "x" | "y" | "z"]}`, b)

  const lines: string[] = []
  const cellWidth = 5

  lines.push(`${axis.toUpperCase()}=${value}:`)
  let header = `${v}\\${h}`.padStart(5)
  for (let hVal = minH; hVal <= maxH; hVal++) {
    header += String(hVal).padStart(cellWidth)
  }
  lines.push(header)

  for (let vVal = minV; vVal <= maxV; vVal++) {
    let row = String(vVal).padStart(5)
    for (let hVal = minH; hVal <= maxH; hVal++) {
      const block = grid.get(`${hVal},${vVal}`)
      row += blockSymbol(block, axis).padStart(cellWidth)
    }
    lines.push(row)
  }

  lines.push("")
  lines.push("Details:")
  for (let vVal = minV; vVal <= maxV; vVal++) {
    for (let hVal = minH; hVal <= maxH; hVal++) {
      const block = grid.get(`${hVal},${vVal}`)
      if (block) {
        lines.push(`  [${v}=${vVal},${h}=${hVal}] ${block.type} ${blockDetails(block)}`)
      }
    }
  }

  return lines.join("\n")
}

export function blockSymbol(block: Block | undefined, sliceAxis: SliceAxis): string {
  if (!block) return "."

  const arrow = (facing: Vec): string => {
    if (sliceAxis === "y") {
      if (facing.x === 1) return "→"
      if (facing.x === -1) return "←"
      if (facing.z === 1) return "↓"
      if (facing.z === -1) return "↑"
      if (facing.y === 1) return "⊙"
      if (facing.y === -1) return "⊗"
    } else if (sliceAxis === "x") {
      if (facing.z === 1) return "→"
      if (facing.z === -1) return "←"
      if (facing.y === 1) return "↑"
      if (facing.y === -1) return "↓"
      if (facing.x === 1) return "⊙"
      if (facing.x === -1) return "⊗"
    } else {
      if (facing.x === 1) return "→"
      if (facing.x === -1) return "←"
      if (facing.y === 1) return "↑"
      if (facing.y === -1) return "↓"
      if (facing.z === 1) return "⊙"
      if (facing.z === -1) return "⊗"
    }
    return "?"
  }

  switch (block.type) {
    case "solid":
      return block.powerState === "strongly-powered" ? "S+" : block.powerState === "weakly-powered" ? "S~" : "S"
    case "slime":
      return block.powerState === "strongly-powered" ? "SL+" : block.powerState === "weakly-powered" ? "SL~" : "SL"
    case "redstone-block":
      return "RB"
    case "dust":
      return `D${block.signalStrength}`
    case "lever":
      return block.on ? "L+" : "L-"
    case "button":
      return block.pressed ? "B+" : "B-"
    case "torch":
      return block.burnedOut ? "TX" : block.lit ? "T+" : "T-"
    case "pressure-plate":
      return block.active ? "PP+" : "PP-"
    case "repeater": {
      const d = block.delay / 2
      const state = block.locked ? "L" : block.outputOn ? "*" : ""
      return `R${arrow(block.facing)}${d}${state}`
    }
    case "comparator": {
      const mode = block.mode === "subtraction" ? "-" : "="
      const out = block.outputSignal > 0 ? block.outputSignal : ""
      return `C${mode}${arrow(block.facing)}${out}`
    }
    case "piston": {
      const state = block.extended ? "+" : block.activationTick !== null ? "!" : ""
      return `P${arrow(block.facing)}${state}`
    }
    case "sticky-piston": {
      const state = block.extended ? "+" : block.activationTick !== null ? "!" : ""
      return `Q${arrow(block.facing)}${state}`
    }
    case "observer":
      return `O${arrow(block.facing)}${block.outputOn ? "*" : ""}`
    default:
      return "?"
  }
}

export function blockDetails(block: Block): string {
  const facing = (f: Vec) => `facing=(${f.x},${f.y},${f.z})`
  switch (block.type) {
    case "solid": return `[power=${block.powerState}]`
    case "slime": return `[power=${block.powerState}]`
    case "dust": return `[SS=${block.signalStrength}, shape=${block.shape}]`
    case "lever": return `[on=${block.on}, ${facing(block.attachedFace)}]`
    case "button": return `[pressed=${block.pressed}]`
    case "torch": return `[lit=${block.lit}, burnedOut=${block.burnedOut}]`
    case "pressure-plate": return `[active=${block.active}, entities=${block.entityCount}]`
    case "redstone-block": return `[always-on]`
    case "repeater": return `[out=${block.outputOn}, delay=${block.delay}, locked=${block.locked}, ${facing(block.facing)}]`
    case "comparator": return `[out=${block.outputSignal}, mode=${block.mode}, rear=${block.rearSignal}, ${facing(block.facing)}]`
    case "piston": return `[extended=${block.extended}, ${facing(block.facing)}]`
    case "sticky-piston": return `[extended=${block.extended}, ${facing(block.facing)}]`
    case "observer": return `[out=${block.outputOn}, ${facing(block.facing)}]`
    default: return ""
  }
}

