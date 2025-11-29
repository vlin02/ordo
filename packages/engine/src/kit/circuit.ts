/**
 * Circuit - directed graph of redstone power relationships.
 *
 * Nodes: blocks    Edges: power flows FROM → TO
 *
 * Example (lever + 4 dust East):
 *   0,1,0     L-*
 *   0,0,0     └─strong→ S^           strongly powers solid
 *   4,0,0       └─E×4→ D12·          dust chain (4 East, ends SS=12)
 *   4,-1,0        ├─weak→ S~         weakly powers support
 *   3,0,0         └─signal(11)→ ↩ D13·  backward edge (cycle)
 *
 * Symbols: L=lever R=repeater D##=dust(SS) S=solid T=torch P=piston O=observer
 *          *=on ^=strong ~=weak ·=active ↩=cycle
 *
 * Edge Types:
 * | Type     | From             | To                         | Notes                    |
 * |----------|------------------|----------------------------|--------------------------|
 * | signal   | source/conductor | dust, repeater, comparator | SS 0-15, decays in dust  |
 * | strong   | source           | solid/slime                | enables SS=15 to dust    |
 * | weak     | dust             | solid/slime                | activates pistons only   |
 * | activate | power source     | piston (not front)         | causes extension         |
 * | quasi    | anything at Y+1  | piston                     | BUD mechanic             |
 * | lock     | repeater (side)  | repeater                   | freezes output           |
 * | invert   | solid (strong)   | attached torch             | torch turns off          |
 * | side     | dust/repeater    | comparator side            | affects output calc      |
 */

import { Vec, Y, HORIZONTALS } from "../vec.js"
import type { Block } from "../blocks/index.js"
import type { World } from "../world.js"
import { blockSymbol } from "./grid.js"

export type EdgeType =
  | "signal"
  | "strong"
  | "weak"
  | "activate"
  | "quasi"
  | "lock"
  | "invert"
  | "side"

export type Node = {
  pos: Vec
  block: Block
}

export type Edge = {
  from: Vec
  to: Vec
  type: EdgeType
  strength?: number
  active: boolean
}

export class Circuit {
  readonly nodes: Map<string, Node>
  readonly edges: Edge[]
  readonly world: World
  private incomingCache: Map<string, Edge[]> | null = null
  private outgoingCache: Map<string, Edge[]> | null = null

  constructor(nodes: Map<string, Node>, edges: Edge[], world: World) {
    this.nodes = nodes
    this.edges = edges
    this.world = world
  }

  getNode(pos: Vec): Node | undefined {
    return this.nodes.get(pos.toKey())
  }

  getIncoming(pos: Vec): Edge[] {
    if (!this.incomingCache) {
      this.incomingCache = new Map()
      for (const edge of this.edges) {
        const key = edge.to.toKey()
        const list = this.incomingCache.get(key) ?? []
        list.push(edge)
        this.incomingCache.set(key, list)
      }
    }
    return this.incomingCache.get(pos.toKey()) ?? []
  }

  getOutgoing(pos: Vec): Edge[] {
    if (!this.outgoingCache) {
      this.outgoingCache = new Map()
      for (const edge of this.edges) {
        const key = edge.from.toKey()
        const list = this.outgoingCache.get(key) ?? []
        list.push(edge)
        this.outgoingCache.set(key, list)
      }
    }
    return this.outgoingCache.get(pos.toKey()) ?? []
  }

  getActiveIncoming(pos: Vec): Edge[] {
    return this.getIncoming(pos).filter(e => e.active)
  }

  getActiveOutgoing(pos: Vec): Edge[] {
    return this.getOutgoing(pos).filter(e => e.active)
  }

  print(opts: { showInactive?: boolean } = {}): string {
    const activeOnly = !opts.showInactive
    const getOut = activeOnly ? (p: Vec) => this.getActiveOutgoing(p) : (p: Vec) => this.getOutgoing(p)
    const getIn = activeOnly ? (p: Vec) => this.getActiveIncoming(p) : (p: Vec) => this.getIncoming(p)
    const sources = [...this.nodes.values()].filter(
      n => getIn(n.pos).length === 0 && getOut(n.pos).length > 0
    )
    return sources.map(s => this.printTreeFrom(s.pos, new Set(), "", activeOnly)).join("\n")
  }

  printFrom(pos: Vec, opts: { showInactive?: boolean } = {}): string {
    return this.printTreeFrom(pos, new Set(), "", !opts.showInactive)
  }

  printTo(pos: Vec, opts: { showInactive?: boolean } = {}): string {
    return this.printTreeTo(pos, new Set(), "", !opts.showInactive)
  }

  cycles(): Edge[][] {
    const result: Edge[][] = []
    const visited = new Set<string>()
    const stack: Vec[] = []
    const stackSet = new Set<string>()

    const dfs = (pos: Vec, path: Edge[]) => {
      const key = pos.toKey()
      if (stackSet.has(key)) {
        const cycleStart = stack.findIndex(p => p.toKey() === key)
        result.push(path.slice(cycleStart))
        return
      }
      if (visited.has(key)) return
      visited.add(key)
      stack.push(pos)
      stackSet.add(key)
      for (const edge of this.getOutgoing(pos)) {
        dfs(edge.to, [...path, edge])
      }
      stack.pop()
      stackSet.delete(key)
    }

    for (const node of this.nodes.values()) {
      dfs(node.pos, [])
    }
    return result
  }

  private printTreeTo(pos: Vec, visited: Set<string>, indent: string, activeOnly: boolean): string {
    const key = pos.toKey()
    const node = this.getNode(pos)
    const { sym, pos: p } = this.fmtNode(node)
    if (visited.has(key)) return this.fmtLine(p, indent, `↩ ${sym}`)
    visited.add(key)

    const incoming = activeOnly ? this.getActiveIncoming(pos) : this.getIncoming(pos)
    if (incoming.length === 0) return this.fmtLine(p, indent, sym)

    const lines: string[] = [this.fmtLine(p, indent, sym)]
    for (let i = 0; i < incoming.length; i++) {
      const edge = incoming[i]
      const isLast = i === incoming.length - 1
      const prefix = isLast ? "└─" : "├─"
      const childIndent = indent + (isLast ? "  " : "│ ")
      const from = this.fmtNode(this.getNode(edge.from))
      lines.push(this.fmtLine(from.pos, `${indent}${prefix}`, `${this.fmtEdge(edge, !activeOnly)} ${from.sym}`))
      lines.push(this.printChildrenTo(edge.from, visited, childIndent, activeOnly))
    }
    return lines.filter(l => l).join("\n")
  }

  private printChildrenTo(pos: Vec, visited: Set<string>, indent: string, activeOnly: boolean): string {
    const key = pos.toKey()
    if (visited.has(key)) return ""
    visited.add(key)

    const incoming = activeOnly ? this.getActiveIncoming(pos) : this.getIncoming(pos)
    if (incoming.length === 0) return ""

    const lines: string[] = []
    for (let i = 0; i < incoming.length; i++) {
      const edge = incoming[i]
      const isLast = i === incoming.length - 1
      const prefix = isLast ? "└─" : "├─"
      const childIndent = indent + (isLast ? "  " : "│ ")
      const from = this.fmtNode(this.getNode(edge.from))
      if (visited.has(edge.from.toKey())) {
        lines.push(this.fmtLine(from.pos, `${indent}${prefix}`, `${this.fmtEdge(edge, !activeOnly)} ↩ ${from.sym}`))
      } else {
        lines.push(this.fmtLine(from.pos, `${indent}${prefix}`, `${this.fmtEdge(edge, !activeOnly)} ${from.sym}`))
        lines.push(this.printChildrenTo(edge.from, visited, childIndent, activeOnly))
      }
    }
    return lines.filter(l => l).join("\n")
  }

  private printTreeFrom(pos: Vec, visited: Set<string>, indent: string, activeOnly: boolean): string {
    const key = pos.toKey()
    const node = this.getNode(pos)
    const { sym, pos: p } = this.fmtNode(node)
    if (visited.has(key)) return this.fmtLine(p, indent, `↩ ${sym}`)
    visited.add(key)

    const outgoing = activeOnly ? this.getActiveOutgoing(pos) : this.getOutgoing(pos)
    if (outgoing.length === 0) return this.fmtLine(p, indent, sym)

    const lines: string[] = [this.fmtLine(p, indent, sym)]
    for (let i = 0; i < outgoing.length; i++) {
      const edge = outgoing[i]
      const isLast = i === outgoing.length - 1
      const prefix = isLast ? "└─" : "├─"
      const childIndent = indent + (isLast ? "  " : "│ ")

      // Try to collapse dust chains
      const chain = this.traceDustChain(edge, new Set(visited), activeOnly)
      if (chain) {
        const { path, endEdge } = chain
        for (let j = 0; j < path.length - 1; j++) visited.add(path[j].to.toKey())
        const dir = this.chainDirection(path)
        const end = this.fmtNode(this.getNode(endEdge.to))
        lines.push(this.fmtLine(end.pos, `${indent}${prefix}`, `${dir}×${path.length}→ ${end.sym}`))
        lines.push(this.printChildrenFrom(endEdge.to, visited, childIndent, activeOnly))
      } else {
        const to = this.fmtNode(this.getNode(edge.to))
        if (visited.has(edge.to.toKey())) {
          lines.push(this.fmtLine(to.pos, `${indent}${prefix}`, `${this.fmtEdge(edge, !activeOnly)} ↩ ${to.sym}`))
        } else {
          lines.push(this.fmtLine(to.pos, `${indent}${prefix}`, `${this.fmtEdge(edge, !activeOnly)} ${to.sym}`))
          lines.push(this.printChildrenFrom(edge.to, visited, childIndent, activeOnly))
        }
      }
    }
    return lines.filter(l => l).join("\n")
  }

  private printChildrenFrom(pos: Vec, visited: Set<string>, indent: string, activeOnly: boolean): string {
    const key = pos.toKey()
    if (visited.has(key)) return ""
    visited.add(key)

    const outgoing = activeOnly ? this.getActiveOutgoing(pos) : this.getOutgoing(pos)
    if (outgoing.length === 0) return ""

    const lines: string[] = []
    for (let i = 0; i < outgoing.length; i++) {
      const edge = outgoing[i]
      const isLast = i === outgoing.length - 1
      const prefix = isLast ? "└─" : "├─"
      const childIndent = indent + (isLast ? "  " : "│ ")

      const chain = this.traceDustChain(edge, new Set(visited), activeOnly)
      if (chain) {
        const { path, endEdge } = chain
        for (let j = 0; j < path.length - 1; j++) visited.add(path[j].to.toKey())
        const dir = this.chainDirection(path)
        const end = this.fmtNode(this.getNode(endEdge.to))
        lines.push(this.fmtLine(end.pos, `${indent}${prefix}`, `${dir}×${path.length}→ ${end.sym}`))
        lines.push(this.printChildrenFrom(endEdge.to, visited, childIndent, activeOnly))
      } else {
        const to = this.fmtNode(this.getNode(edge.to))
        if (visited.has(edge.to.toKey())) {
          lines.push(this.fmtLine(to.pos, `${indent}${prefix}`, `${this.fmtEdge(edge, !activeOnly)} ↩ ${to.sym}`))
        } else {
          lines.push(this.fmtLine(to.pos, `${indent}${prefix}`, `${this.fmtEdge(edge, !activeOnly)} ${to.sym}`))
          lines.push(this.printChildrenFrom(edge.to, visited, childIndent, activeOnly))
        }
      }
    }
    return lines.filter(l => l).join("\n")
  }

  private traceDustChain(
    startEdge: Edge,
    visited: Set<string>,
    activeOnly: boolean
  ): { path: Edge[]; endEdge: Edge } | null {
    // Only collapse signal edges between dust blocks
    if (startEdge.type !== "signal") return null
    const startNode = this.getNode(startEdge.to)
    if (startNode?.block.type !== "dust") return null

    const path: Edge[] = [startEdge]
    let current = startEdge

    while (true) {
      const currentNode = this.getNode(current.to)
      if (!currentNode || currentNode.block.type !== "dust") break
      if (visited.has(current.to.toKey())) break

      const currentSS = (currentNode.block as { signalStrength: number }).signalStrength
      const outgoing = activeOnly
        ? this.getActiveOutgoing(current.to)
        : this.getOutgoing(current.to)

      // Only follow "forward" dust edges (target has lower SS than current)
      const forwardDustEdges = outgoing.filter(e => {
        if (e.type !== "signal") return false
        const targetNode = this.getNode(e.to)
        if (targetNode?.block.type !== "dust") return false
        const targetSS = (targetNode.block as { signalStrength: number }).signalStrength
        return targetSS < currentSS
      })
      if (forwardDustEdges.length !== 1) break

      // Must have no other significant outgoing edges (weak to solid is ok)
      const otherEdges = outgoing.filter(e =>
        e.type !== "signal" || this.getNode(e.to)?.block.type !== "dust"
      )
      if (otherEdges.some(e => e.type !== "weak")) break

      visited.add(current.to.toKey())
      current = forwardDustEdges[0]
      path.push(current)
    }

    // Need at least 2 edges to form a meaningful chain
    return path.length >= 2 ? { path, endEdge: current } : null
  }

  private chainDirection(path: Edge[]): string {
    const dirs: string[] = []
    for (const edge of path) {
      const dx = edge.to.x - edge.from.x
      const dz = edge.to.z - edge.from.z
      if (dx > 0) dirs.push("E")
      else if (dx < 0) dirs.push("W")
      else if (dz > 0) dirs.push("S")
      else if (dz < 0) dirs.push("N")
    }
    // Compress: EEEE → E, EESS → ES
    const compressed: string[] = []
    for (const d of dirs) {
      if (compressed[compressed.length - 1] !== d) compressed.push(d)
    }
    return compressed.join("")
  }

  private fmtNode(node: Node | undefined): { sym: string; pos: string } {
    if (!node?.block) return { sym: "·", pos: "" }
    return { sym: blockSymbol(node.block, this.world), pos: `${node.pos.x},${node.pos.y},${node.pos.z}` }
  }

  private fmtLine(pos: string, indent: string, content: string): string {
    return `${pos.padEnd(10)}${indent}${content}`
  }

  private fmtEdge(edge: Edge, showInactive = false): string {
    const strength = edge.strength !== undefined ? `${edge.strength}` : ""
    const inactive = showInactive && !edge.active ? "○" : ""
    const label = strength ? `${edge.type}(${strength})` : edge.type
    return `${inactive}${label}→`
  }
}

export function trace(world: World): Circuit {
  const nodes = new Map<string, Node>()
  const edges: Edge[] = []

  for (const block of world.getAllBlocks()) {
    nodes.set(block.pos.toKey(), { pos: block.pos, block })
  }

  for (const block of world.getAllBlocks()) {
    collectEdges(world, block, edges)
  }

  return new Circuit(nodes, edges, world)
}

function collectEdges(world: World, block: Block, edges: Edge[]): void {
  const pos = block.pos

  switch (block.type) {
    case "lever":
      addSourceEdges(world, pos, block.attachedPos, block.on, edges)
      break

    case "button":
      addSourceEdges(world, pos, block.attachedPos, block.pressed, edges)
      break

    case "pressure-plate": {
      const below = pos.add(Y.neg)
      const active = block.active
      const strength = block.getOutputSignal()
      edges.push({ from: pos, to: below, type: "strong", active })
      for (const adj of pos.adjacents()) {
        const adjBlock = world.getBlock(adj)
        if (adjBlock?.type === "dust") {
          edges.push({ from: pos, to: adj, type: "signal", strength, active })
        }
        addPistonActivation(world, pos, adj, active, edges)
      }
      break
    }

    case "redstone-block":
      for (const adj of pos.adjacents()) {
        const adjBlock = world.getBlock(adj)
        if (adjBlock?.type === "dust") {
          edges.push({ from: pos, to: adj, type: "signal", strength: 15, active: true })
        }
        if (adjBlock?.type === "comparator") {
          const isSide = isComparatorSide(adjBlock, pos)
          if (isSide) {
            edges.push({ from: pos, to: adj, type: "side", strength: 15, active: true })
          }
        }
        addPistonActivation(world, pos, adj, true, edges)
      }
      break

    case "torch": {
      const lit = block.lit && !block.burnedOut
      for (const adj of pos.adjacents()) {
        if (adj.equals(block.attachedPos)) continue
        const adjBlock = world.getBlock(adj)
        if (adjBlock?.type === "dust") {
          edges.push({ from: pos, to: adj, type: "signal", strength: 15, active: lit })
        }
        addPistonActivation(world, pos, adj, lit, edges)
      }
      const above = pos.add(Y)
      const aboveBlock = world.getBlock(above)
      if (aboveBlock?.type === "solid" || aboveBlock?.type === "slime") {
        edges.push({ from: pos, to: above, type: "strong", active: lit })
      }
      // Invert edge: attached block can turn off torch
      const attachedBlock = world.getBlock(block.attachedPos)
      if (attachedBlock?.type === "solid" || attachedBlock?.type === "slime") {
        const powered = attachedBlock.powerState === "strongly-powered"
        edges.push({ from: block.attachedPos, to: pos, type: "invert", active: powered })
      }
      break
    }

    case "repeater": {
      const front = pos.add(block.facing)
      const frontBlock = world.getBlock(front)
      const active = block.outputOn && !block.locked
      edges.push({ from: pos, to: front, type: "signal", strength: 15, active })
      if (frontBlock?.type === "solid" || frontBlock?.type === "slime") {
        edges.push({ from: pos, to: front, type: "strong", active })
      }
      addPistonActivation(world, pos, front, active, edges)
      // Lock edges from side repeaters
      for (const dir of HORIZONTALS) {
        if (dir.equals(block.facing) || dir.equals(block.facing.neg)) continue
        const sidePos = pos.add(dir)
        const sideBlock = world.getBlock(sidePos)
        if (sideBlock?.type === "repeater" && sideBlock.facing.equals(dir.neg)) {
          edges.push({ from: sidePos, to: pos, type: "lock", active: sideBlock.outputOn })
        }
      }
      break
    }

    case "comparator": {
      const front = pos.add(block.facing)
      const frontBlock = world.getBlock(front)
      const active = block.outputSignal > 0
      edges.push({ from: pos, to: front, type: "signal", strength: block.outputSignal, active })
      if (frontBlock?.type === "solid" || frontBlock?.type === "slime") {
        edges.push({ from: pos, to: front, type: "strong", active })
      }
      addPistonActivation(world, pos, front, active, edges)
      // Side input edges
      for (const dir of HORIZONTALS) {
        if (dir.equals(block.facing) || dir.equals(block.facing.neg)) continue
        const sidePos = pos.add(dir)
        const sideBlock = world.getBlock(sidePos)
        if (!sideBlock) continue
        const sideSignal = getSideSignal(sideBlock, dir.neg)
        if (sideSignal !== null) {
          edges.push({ from: sidePos, to: pos, type: "side", strength: sideSignal, active: sideSignal > 0 })
        }
      }
      break
    }

    case "observer": {
      const back = pos.add(block.facing.neg)
      const backBlock = world.getBlock(back)
      const active = block.outputOn
      edges.push({ from: pos, to: back, type: "signal", strength: 15, active })
      if (backBlock?.type === "solid" || backBlock?.type === "slime") {
        edges.push({ from: pos, to: back, type: "strong", active })
      }
      addPistonActivation(world, pos, back, active, edges)
      break
    }

    case "dust": {
      const ss = block.signalStrength
      const active = ss > 0
      const below = pos.add(Y.neg)
      const belowBlock = world.getBlock(below)
      if (belowBlock?.type === "solid" || belowBlock?.type === "slime") {
        edges.push({ from: pos, to: below, type: "weak", active })
      }
      if (belowBlock?.type === "piston" || belowBlock?.type === "sticky-piston") {
        edges.push({ from: pos, to: below, type: "activate", active })
      }
      if (block.shape !== "dot") {
        const connections = world.findDustConnections(block)
        for (const conn of connections) {
          const connBlock = world.getBlock(conn)
          if (connBlock?.type === "dust") {
            edges.push({ from: pos, to: conn, type: "signal", strength: Math.max(0, ss - 1), active })
          }
        }
        for (const dir of HORIZONTALS) {
          const adj = pos.add(dir)
          if (world.isDustPointingAt(block, adj)) {
            const adjBlock = world.getBlock(adj)
            if (adjBlock?.type === "solid" || adjBlock?.type === "slime") {
              edges.push({ from: pos, to: adj, type: "weak", active })
            }
            addPistonActivation(world, pos, adj, active, edges)
          }
        }
      }
      break
    }

    case "solid":
    case "slime": {
      const strongly = block.powerState === "strongly-powered"
      const powered = block.powerState !== "unpowered"
      if (strongly) {
        for (const adj of pos.adjacents()) {
          const adjBlock = world.getBlock(adj)
          if (adjBlock?.type === "dust") {
            edges.push({ from: pos, to: adj, type: "signal", strength: 15, active: true })
          }
        }
      }
      if (powered) {
        for (const adj of pos.adjacents()) {
          addPistonActivation(world, pos, adj, true, edges)
        }
      }
      // Quasi-connectivity: check if this block can power piston below via BUD
      const pistonBelow = world.getBlock(pos.add(Y.neg))
      if (pistonBelow?.type === "piston" || pistonBelow?.type === "sticky-piston") {
        if (powered) {
          edges.push({ from: pos, to: pos.add(Y.neg), type: "quasi", active: true })
        }
      }
      break
    }

    case "piston":
    case "sticky-piston":
      // Quasi-connectivity: check blocks at Y+1 that would activate
      addQuasiEdges(world, block, edges)
      break
  }
}

function addSourceEdges(world: World, pos: Vec, attachedPos: Vec, active: boolean, edges: Edge[]): void {
  for (const adj of pos.adjacents()) {
    const adjBlock = world.getBlock(adj)
    if (adjBlock?.type === "dust") {
      edges.push({ from: pos, to: adj, type: "signal", strength: 15, active })
    }
    addPistonActivation(world, pos, adj, active, edges)
  }
  const attached = world.getBlock(attachedPos)
  if (attached?.type === "solid" || attached?.type === "slime") {
    edges.push({ from: pos, to: attachedPos, type: "strong", active })
  }
}

function addPistonActivation(world: World, from: Vec, to: Vec, active: boolean, edges: Edge[]): void {
  const block = world.getBlock(to)
  if (block?.type !== "piston" && block?.type !== "sticky-piston") return
  // Can't activate from front face
  const pistonFront = to.add(block.facing)
  if (pistonFront.equals(from)) return
  edges.push({ from, to, type: "activate", active })
}

function addQuasiEdges(world: World, piston: Block, edges: Edge[]): void {
  if (piston.type !== "piston" && piston.type !== "sticky-piston") return
  const pos = piston.pos
  const above = pos.add(Y)

  // Check all positions that could quasi-power: adjacent to above position
  for (const adj of above.adjacents()) {
    const adjBlock = world.getBlock(adj)
    if (!adjBlock) continue
    // Skip front face of piston (checked at Y+1)
    const pistonFrontAbove = above.add(piston.facing)
    if (adj.equals(pistonFrontAbove)) continue

    const active = isBlockActivating(adjBlock)
    if (active !== null) {
      edges.push({ from: adj, to: pos, type: "quasi", active })
    }
  }

  // Check block directly above
  const aboveBlock = world.getBlock(above)
  if (aboveBlock) {
    const active = isBlockActivating(aboveBlock)
    if (active !== null) {
      edges.push({ from: above, to: pos, type: "quasi", active })
    }
  }
}

function isBlockActivating(block: Block): boolean | null {
  switch (block.type) {
    case "lever": return block.on
    case "button": return block.pressed
    case "pressure-plate": return block.active
    case "redstone-block": return true
    case "torch": return block.lit && !block.burnedOut
    case "repeater": return block.outputOn
    case "comparator": return block.outputSignal > 0
    case "observer": return block.outputOn
    case "solid":
    case "slime": return block.powerState !== "unpowered"
    case "dust": return block.signalStrength > 0
    default: return null
  }
}

function isComparatorSide(comparator: Block, fromPos: Vec): boolean {
  if (comparator.type !== "comparator") return false
  const dx = fromPos.x - comparator.pos.x
  const dz = fromPos.z - comparator.pos.z
  // Side if perpendicular to facing
  if (comparator.facing.x !== 0) return dz !== 0 && dx === 0
  if (comparator.facing.z !== 0) return dx !== 0 && dz === 0
  return false
}

function getSideSignal(block: Block, towardComparator: Vec): number | null {
  switch (block.type) {
    case "dust":
      return block.signalStrength
    case "redstone-block":
      return 15
    case "repeater":
      return block.facing.equals(towardComparator) && block.outputOn ? 15 : null
    case "comparator":
      return block.facing.equals(towardComparator) ? block.outputSignal : null
    case "observer":
      return block.facing.neg.equals(towardComparator) && block.outputOn ? 15 : null
    default:
      return null
  }
}

