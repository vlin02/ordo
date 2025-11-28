import { Vec } from "./vec.js"
import type { Block } from "./blocks/index.js"

export type PowerEdgeType = "strong" | "weak" | "signal" | "activation"

export type PowerNode = {
  pos: Vec
  block: Block | null
  state: string
}

export type PowerEdge = {
  from: Vec
  to: Vec
  type: PowerEdgeType
  signalStrength?: number
}

export class PowerGraph {
  readonly nodes: Map<string, PowerNode>
  readonly edges: PowerEdge[]
  private incomingCache: Map<string, PowerEdge[]> | null = null
  private outgoingCache: Map<string, PowerEdge[]> | null = null

  constructor(nodes: Map<string, PowerNode>, edges: PowerEdge[]) {
    this.nodes = nodes
    this.edges = edges
  }

  getNode(pos: Vec): PowerNode | undefined {
    return this.nodes.get(pos.toKey())
  }

  getIncoming(pos: Vec): PowerEdge[] {
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

  getOutgoing(pos: Vec): PowerEdge[] {
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

  print(): string {
    const lines: string[] = ["=== Power Graph ==="]
    
    const sources = [...this.nodes.values()].filter(
      n => this.getIncoming(n.pos).length === 0 && this.getOutgoing(n.pos).length > 0
    )
    
    for (const source of sources) {
      lines.push(this.printTreeFrom(source.pos, new Set(), ""))
    }
    
    return lines.join("\n")
  }

  printFrom(pos: Vec): string {
    return this.printTreeFrom(pos, new Set(), "")
  }

  printTo(pos: Vec): string {
    return this.printTreeTo(pos, new Set(), "")
  }

  private printTreeTo(pos: Vec, visited: Set<string>, indent: string): string {
    const key = pos.toKey()
    const node = this.getNode(pos)
    
    if (visited.has(key)) {
      return `${indent}${this.formatNode(node)} ↩ (cycle)`
    }
    
    visited.add(key)
    const lines: string[] = [indent + this.formatNode(node)]
    
    const incoming = this.getIncoming(pos)
    for (let i = 0; i < incoming.length; i++) {
      const edge = incoming[i]
      const isLast = i === incoming.length - 1
      const prefix = isLast ? "└─" : "├─"
      const childIndent = indent + (isLast ? "   " : "│  ")
      const sourceNode = this.getNode(edge.from)
      const provides = this.edgeProvidesPower(edge, sourceNode)
      const mark = provides ? "✓" : "✗"
      
      lines.push(`${indent}${prefix} ${mark} ${this.formatEdgeType(edge)}`)
      lines.push(this.printTreeTo(edge.from, visited, childIndent))
    }
    
    return lines.join("\n")
  }

  private printTreeFrom(pos: Vec, visited: Set<string>, indent: string): string {
    const key = pos.toKey()
    const node = this.getNode(pos)
    
    if (visited.has(key)) {
      return `${indent}${this.formatNode(node)} ↩ (cycle)`
    }
    
    visited.add(key)
    const lines: string[] = [indent + this.formatNode(node)]
    
    const outgoing = this.getOutgoing(pos)
    for (let i = 0; i < outgoing.length; i++) {
      const edge = outgoing[i]
      const isLast = i === outgoing.length - 1
      const prefix = isLast ? "└─" : "├─"
      const childIndent = indent + (isLast ? "   " : "│  ")
      
      lines.push(`${indent}${prefix} ${this.formatEdgeType(edge)}`)
      lines.push(this.printTreeFrom(edge.to, visited, childIndent))
    }
    
    return lines.join("\n")
  }

  private formatNode(node: PowerNode | undefined): string {
    if (!node || !node.block) return "Air"
    const b = node.block
    const pos = `${b.pos.x},${b.pos.y},${b.pos.z}`
    return `${capitalize(b.type)}(${pos}) [${node.state}]`
  }

  private formatEdge(edge: PowerEdge): string {
    if (edge.signalStrength !== undefined) {
      return `${edge.type}(${edge.signalStrength})`
    }
    return edge.type
  }

  private formatEdgeType(edge: PowerEdge): string {
    if (edge.signalStrength !== undefined) {
      return `${edge.type}(${edge.signalStrength}) →`
    }
    return `${edge.type} →`
  }

  private isActivated(node: PowerNode): boolean {
    if (!node.block) return false
    const t = node.block.type
    if (t === "piston" || t === "sticky-piston") {
      return (node.block as any).extended || (node.block as any).activationTick !== null
    }
    return false
  }

  private edgeProvidesPower(edge: PowerEdge, source: PowerNode | undefined): boolean {
    if (!source?.block) return false
    const b = source.block
    switch (b.type) {
      case "lever": return b.on
      case "button": return b.pressed
      case "pressure-plate": return b.active
      case "torch": return b.lit
      case "redstone-block": return true
      case "repeater": return b.outputOn
      case "comparator": return b.outputSignal > 0
      case "observer": return b.outputOn
      case "dust": return b.signalStrength > 0
      case "solid":
      case "slime":
        return b.powerState !== "unpowered"
      default: return false
    }
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function describeBlockState(block: Block): string {
  switch (block.type) {
    case "lever": return `on=${block.on}`
    case "button": return `pressed=${block.pressed}`
    case "pressure-plate": return `active=${block.active}`
    case "dust": return `SS=${block.signalStrength}`
    case "torch": return `lit=${block.lit}`
    case "repeater": return `out=${block.outputOn},delay=${block.delay}`
    case "comparator": return `out=${block.outputSignal},mode=${block.mode}`
    case "observer": return `out=${block.outputOn}`
    case "piston":
    case "sticky-piston": return `ext=${block.extended}`
    case "solid":
    case "slime": return block.powerState
    case "redstone-block": return "always-on"
    default: return ""
  }
}

