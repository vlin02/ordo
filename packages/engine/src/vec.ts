export class Vec {
  constructor(
    public readonly x: number,
    public readonly y: number,
    public readonly z: number
  ) {}

  add(other: Vec): Vec {
    return new Vec(this.x + other.x, this.y + other.y, this.z + other.z)
  }

  get neg(): Vec {
    return new Vec(-this.x, -this.y, -this.z)
  }

  equals(other: Vec): boolean {
    return this.x === other.x && this.y === other.y && this.z === other.z
  }

  dot(other: Vec): number {
    return this.x * other.x + this.y * other.y + this.z * other.z
  }

  toKey(): string {
    return `${this.x},${this.y},${this.z}`
  }

  static fromKey(key: string): Vec {
    const [x, y, z] = key.split(",").map(Number)
    return new Vec(x, y, z)
  }

  adjacents(): Vec[] {
    return ALL_DIRECTIONS.map(d => this.add(d))
  }

  perpendiculars(): Vec[] {
    if (this.x !== 0) return [Z, Z.neg]
    if (this.z !== 0) return [X, X.neg]
    return [X, X.neg]
  }
}

export const X = new Vec(1, 0, 0)
export const Y = new Vec(0, 1, 0)
export const Z = new Vec(0, 0, 1)

export const HORIZONTALS = [X, X.neg, Z, Z.neg]
export const ALL_DIRECTIONS = [X, X.neg, Y, Y.neg, Z, Z.neg]

