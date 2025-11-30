/**
 * Grid visualization for redstone debugging (Y-slice only).
 *
 * Facing: → +X | ← -X | ↓ +Z | ↑ -Z | + +Y | - -Y
 *
 * | Block          | Format                  | Examples                                         |
 * |----------------|-------------------------|--------------------------------------------------|
 * | air            | \.                      | .                                                |
 * | solid          | S(\^|~)?                | S (off)  S^ (strong)  S~ (weak)                  |
 * | slime          | SL(\^|~)?               | SL (off)  SL^ (strong)                           |
 * | redstone-block | RB                      | RB                                               |
 * | dust           | D<sig><shp>             | D15┼ (15,cross)  D08│ (08,NS)  D00· (00,dot)     |
 * | lever          | L<att>\*?               | L-* (floor,on)  L→ (east,off)                    |
 * | button         | B(s|w)<att>\*?          | Bs→* (stone,east,pressed)  Bw← (wood,west,off)   |
 * | torch          | T<att>(\*|x)?           | T-* (floor,lit)  T↓x (south,burned)              |
 * | pressure-plate | PP(w|s|g|i)(\*<cnt>)?   | PPw* (wood,on)  PPg*03 (gold,03 entities)        |
 * | repeater       | R<fac><dly>\*?K?        | R→2* (east,2-tick,on)  R↑4K (north,4,locked)     |
 * | comparator     | C(-|=)<fac><rear>/<out> | C-→12/04 (sub,east,in12,out04)  C=↓08/08 (cmp)   |
 * | piston         | P<fac>(\*|!)?           | P+* (up,extended)  P→! (east,activating)         |
 * | sticky-piston  | SP<fac>(\*|!)?          | SP→* (east,extended)  SP↑! (up,activating)       |
 * | observer       | O<fac>\*?               | O↓* (south,pulsing)  O→ (east,idle)              |
 *
 * Placeholders:
 *   <fac>  facing      →←↓↑+-           direction block points
 *   <att>  attached    →←↓↑+-           direction to supporting block
 *   <sig>  signal      00-15            redstone signal strength (zero-padded)
 *   <shp>  shape       ┼─│┌┐└┘┬┴├┤╵╶╷╴· dust connection shape (see below)
 *   <dly>  delay       1-4              repeater tick delay
 *   <rear> rear input  00-15            comparator rear signal (zero-padded)
 *   <out>  output      00-15            comparator output level (zero-padded)
 *   <cnt>  count       00-15            entity count on plate (zero-padded)
 *
 * Dust shape → directions (N=north ↑, E=east →, S=south ↓, W=west ←):
 *   ┼ = NESW    ─ = EW     │ = NS
 *   ┌ = ES      ┐ = SW     └ = NE     ┘ = NW
 *   ┬ = ESW     ┴ = NEW    ├ = NES    ┤ = NSW
 *   ╵ = N       ╶ = E      ╷ = S      ╴ = W
 *   · = none (dot)
 *
 * Modifiers:
 *   ^  strongly powered    ~  weakly powered
 *   *  on/active/extended  !  activating     x  burned    K  locked
 *
 * Button type: s=stone | w=wood
 * Plate variant: w=wood | s=stone | g=gold (light) | i=iron (heavy)
 */

import { Vec, Y, X, Z } from "../vec.js"
import type { Block, PressurePlateVariant } from "../blocks/index.js"
import type { World } from "../world.js"

const CELL_WIDTH = 9

const DIR_ARROWS: Record<string, string> = {
  "1,0,0": "→", "-1,0,0": "←",
  "0,0,1": "↓", "0,0,-1": "↑",
  "0,1,0": "+", "0,-1,0": "-",
}

const DUST_SHAPES: Record<string, string> = {
  "NESW": "┼", "EW": "─", "NS": "│",
  "ES": "┌", "SW": "┐", "NE": "└", "NW": "┘",
  "ESW": "┬", "NEW": "┴", "NES": "├", "NSW": "┤",
  "N": "╵", "E": "╶", "S": "╷", "W": "╴",
  "": "·",
}

const PLATE_VARIANTS: Record<PressurePlateVariant, string> = {
  wood: "w", stone: "s", "light-weighted": "g", "heavy-weighted": "i",
}
const PLATE_VARIANTS_REV = Object.fromEntries(
  Object.entries(PLATE_VARIANTS).map(([k, v]) => [v, k])
)

const PATTERNS = {
  air: /^\.$/,
  solid: /^S([~^])?$/,
  slime: /^SL([~^])?$/,
  redstoneBlock: /^RB$/,
  dust: /^D(\d{2})([┼─│┌┐└┘┬┴├┤╵╶╷╴·])$/,
  lever: /^L([→←↓↑+-])\*?$/,
  button: /^B([sw])([→←↓↑+-])\*?$/,
  torch: /^T([→←↓↑+-])([*x])?$/,
  pressurePlate: /^PP([wsgi])(\*(\d{2}))?$/,
  repeater: /^R([→←↓↑+-])([1-4])\*?(K)?$/,
  comparator: /^C([-=])([→←↓↑+-])(\d{2})\/(\d{2})$/,
  piston: /^P([→←↓↑+-])([*!])?$/,
  stickyPiston: /^SP([→←↓↑+-])([*!])?$/,
  observer: /^O([→←↓↑+-])\*?$/,
}

export type ParsedSymbol =
  | { type: "air" }
  | { type: "solid"; power?: "strong" | "weak" }
  | { type: "slime"; power?: "strong" | "weak" }
  | { type: "redstone-block" }
  | { type: "dust"; signal: number; shape: string }
  | { type: "lever"; attached: string; on: boolean }
  | { type: "button"; variant: "s" | "w"; attached: string; pressed: boolean }
  | { type: "torch"; attached: string; state: "lit" | "unlit" | "burned" }
  | { type: "pressure-plate"; variant: string; active: boolean; count?: number }
  | { type: "repeater"; facing: string; delay: number; on: boolean; locked: boolean }
  | { type: "comparator"; mode: "sub" | "cmp"; facing: string; rear: number; output: number }
  | { type: "piston"; facing: string; state: "retracted" | "extended" | "activating" }
  | { type: "sticky-piston"; facing: string; state: "retracted" | "extended" | "activating" }
  | { type: "observer"; facing: string; pulsing: boolean }
  | { type: "unknown"; raw: string }

export class GridRenderer {
  constructor(private world?: World) {}

  symbol(block: Block | null | undefined): string {
    if (!block) return "."

    switch (block.type) {
      case "solid": {
        const pwr = block.powerState === "strongly-powered" ? "^" : block.powerState === "weakly-powered" ? "~" : ""
        return `S${pwr}`
      }
      case "slime": {
        const pwr = block.powerState === "strongly-powered" ? "^" : block.powerState === "weakly-powered" ? "~" : ""
        return `SL${pwr}`
      }
      case "redstone-block":
        return "RB"
      case "dust": {
        const sig = this.pad2(block.signalStrength)
        const connections = this.world ? this.getDustConnections(block) : ""
        const shp = DUST_SHAPES[connections] ?? (connections.length === 4 ? "┼" : "·")
        return `D${sig}${shp}`
      }
      case "lever": {
        const att = this.vecToArrow(block.attachedFace)
        const state = block.on ? "*" : ""
        return `L${att}${state}`
      }
      case "button": {
        const variant = block.variant === "wood" ? "w" : "s"
        const att = this.vecToArrow(block.attachedFace)
        const state = block.pressed ? "*" : ""
        return `B${variant}${att}${state}`
      }
      case "torch": {
        const att = this.vecToArrow(block.attachedFace)
        const state = block.burnedOut ? "x" : block.lit ? "*" : ""
        return `T${att}${state}`
      }
      case "pressure-plate": {
        const v = PLATE_VARIANTS[block.variant] ?? "s"
        if (!block.active) return `PP${v}`
        const cnt = this.pad2(block.entityCount)
        return `PP${v}*${cnt}`
      }
      case "repeater": {
        const fac = this.vecToArrow(block.facing)
        const dly = block.delay / 2
        const on = block.outputOn ? "*" : ""
        const locked = block.locked ? "K" : ""
        return `R${fac}${dly}${on}${locked}`
      }
      case "comparator": {
        const mode = block.mode === "subtraction" ? "-" : "="
        const fac = this.vecToArrow(block.facing)
        const rear = this.pad2(block.rearSignal)
        const out = this.pad2(block.outputSignal)
        return `C${mode}${fac}${rear}/${out}`
      }
      case "piston":
      case "sticky-piston": {
        const prefix = block.type === "sticky-piston" ? "SP" : "P"
        const fac = this.vecToArrow(block.facing)
        const state = block.extended ? "*" : block.activationTick !== null ? "!" : ""
        return `${prefix}${fac}${state}`
      }
      case "observer": {
        const fac = this.vecToArrow(block.facing)
        const state = block.outputOn ? "*" : ""
        return `O${fac}${state}`
      }
      default:
        return "?"
    }
  }

  parse(symbol: string): ParsedSymbol {
    if (PATTERNS.air.test(symbol)) return { type: "air" }

    let m: RegExpMatchArray | null
    if ((m = symbol.match(PATTERNS.solid))) {
      const p = m[1]
      return { type: "solid", power: p === "^" ? "strong" : p === "~" ? "weak" : undefined }
    }
    if ((m = symbol.match(PATTERNS.slime))) {
      const p = m[1]
      return { type: "slime", power: p === "^" ? "strong" : p === "~" ? "weak" : undefined }
    }
    if (PATTERNS.redstoneBlock.test(symbol)) return { type: "redstone-block" }
    if ((m = symbol.match(PATTERNS.dust))) {
      return { type: "dust", signal: parseInt(m[1]), shape: m[2] }
    }
    if ((m = symbol.match(PATTERNS.lever))) {
      return { type: "lever", attached: m[1], on: symbol.endsWith("*") }
    }
    if ((m = symbol.match(PATTERNS.button))) {
      return { type: "button", variant: m[1] as "s" | "w", attached: m[2], pressed: symbol.endsWith("*") }
    }
    if ((m = symbol.match(PATTERNS.torch))) {
      const s = m[2]
      return { type: "torch", attached: m[1], state: s === "x" ? "burned" : s === "*" ? "lit" : "unlit" }
    }
    if ((m = symbol.match(PATTERNS.pressurePlate))) {
      return {
        type: "pressure-plate",
        variant: PLATE_VARIANTS_REV[m[1]] ?? m[1],
        active: !!m[2],
        count: m[3] ? parseInt(m[3]) : undefined,
      }
    }
    if ((m = symbol.match(PATTERNS.repeater))) {
      return {
        type: "repeater",
        facing: m[1],
        delay: parseInt(m[2]),
        on: symbol.includes("*"),
        locked: symbol.includes("K"),
      }
    }
    if ((m = symbol.match(PATTERNS.comparator))) {
      return {
        type: "comparator",
        mode: m[1] === "-" ? "sub" : "cmp",
        facing: m[2],
        rear: parseInt(m[3]),
        output: parseInt(m[4]),
      }
    }
    if ((m = symbol.match(PATTERNS.piston))) {
      const s = m[2]
      return { type: "piston", facing: m[1], state: s === "*" ? "extended" : s === "!" ? "activating" : "retracted" }
    }
    if ((m = symbol.match(PATTERNS.stickyPiston))) {
      const s = m[2]
      return { type: "sticky-piston", facing: m[1], state: s === "*" ? "extended" : s === "!" ? "activating" : "retracted" }
    }
    if ((m = symbol.match(PATTERNS.observer))) {
      return { type: "observer", facing: m[1], pulsing: symbol.endsWith("*") }
    }
    return { type: "unknown", raw: symbol }
  }

  private vecToArrow(v: Vec): string {
    return DIR_ARROWS[`${v.x},${v.y},${v.z}`] ?? "?"
  }

  private pad2(n: number): string {
    return n.toString().padStart(2, "0")
  }

  private getDustConnections(dust: Block): string {
    if (dust.type !== "dust" || !this.world) return ""
    if (dust.shape === "dot") return ""

    const dirs: string[] = []
    const pos = dust.pos

    const neighbors = [
      { dir: "N", vec: Z.neg },
      { dir: "E", vec: X },
      { dir: "S", vec: Z },
      { dir: "W", vec: X.neg },
    ]

    for (const { dir, vec } of neighbors) {
      const adjPos = pos.add(vec)
      const adj = this.world.getBlock(adjPos)
      if (adj && this.connectsToDust(adj, vec.neg)) {
        dirs.push(dir)
      }
      const above = this.world.getBlock(adjPos.add(Y))
      if (above?.type === "dust") {
        const blockingAbove = this.world.getBlock(pos.add(Y))
        if (!blockingAbove || blockingAbove.type !== "solid") {
          dirs.push(dir)
        }
      }
      const below = this.world.getBlock(adjPos.add(Y.neg))
      if (below?.type === "dust") {
        if (!adj || adj.type !== "solid") {
          dirs.push(dir)
        }
      }
    }

    const unique = [...new Set(dirs)].sort((a, b) => "NESW".indexOf(a) - "NESW".indexOf(b))
    return unique.join("")
  }

  private connectsToDust(block: Block, fromDir: Vec): boolean {
    switch (block.type) {
      case "dust": return true
      case "lever": return true
      case "torch": return true
      case "redstone-block": return true
      case "repeater": return block.facing.equals(fromDir) || block.facing.neg.equals(fromDir)
      case "comparator": return block.facing.equals(fromDir) || block.facing.neg.equals(fromDir)
      case "observer": return block.facing.neg.equals(fromDir)
      default: return false
    }
  }
}

export class Slice {
  private renderer: GridRenderer

  constructor(readonly world: World) {
    this.renderer = new GridRenderer(world)
  }

  render(y: number, start: [number, number], end: [number, number]): string {
    const [minX, minZ] = start
    const [maxX, maxZ] = end

    const lines: string[] = []
    lines.push(`Y=${y}:`)

    let header = "z\\x".padStart(5)
    for (let x = minX; x <= maxX; x++) header += String(x).padStart(CELL_WIDTH)
    lines.push(header)

    for (let z = minZ; z <= maxZ; z++) {
      let row = String(z).padStart(5)
      for (let x = minX; x <= maxX; x++) {
        const block = this.world.getBlock(new Vec(x, y, z))
        row += this.renderer.symbol(block).padStart(CELL_WIDTH)
      }
      lines.push(row)
    }

    return lines.join("\n")
  }
}

export { PATTERNS }
