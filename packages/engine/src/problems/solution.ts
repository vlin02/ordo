import { Engine, Vec, Solid, StickyPiston, Lever, Dust, Y, Z } from "@ordo/engine"

/**
 * 2x2 Flush Piston Door
 * 
 * Layout (view from +X, looking at Y-Z plane):
 * 
 *   Z: -1    0    1    2    3
 * Y=3            [dust]  [dust]  
 * Y=2      door piston solid  solid
 * Y=1      door piston [dust] solid
 * Y=0      floor floor  floor  
 * 
 * Door blocks at Z=0, pistons at Z=1 facing -Z.
 * When pistons extend, they push door blocks to Z=-1 (opening the door).
 * When pistons retract, they pull door blocks back to Z=0 (closing).
 * 
 * Power: Dust at Y=1 powers bottom pistons directly.
 *        Dust at Y=3 powers top pistons via quasi-connectivity.
 *        Dust step-up ladder connects all levels.
 */
export function build(engine: Engine): void {
  // Floor (Y=0)
  for (let x = -1; x <= 2; x++) {
    for (let z = 0; z <= 3; z++) {
      engine.placeBlock(new Solid(new Vec(x, 0, z)))
    }
  }

  // Wall blocks at Z=0 (sides of door opening)
  engine.placeBlock(new Solid(new Vec(-1, 1, 0)))
  engine.placeBlock(new Solid(new Vec(-1, 2, 0)))
  engine.placeBlock(new Solid(new Vec(2, 1, 0)))
  engine.placeBlock(new Solid(new Vec(2, 2, 0)))

  // Sticky pistons at Z=1 facing -Z
  engine.placeBlock(new StickyPiston(new Vec(0, 1, 1), Z.neg))
  engine.placeBlock(new StickyPiston(new Vec(1, 1, 1), Z.neg))
  engine.placeBlock(new StickyPiston(new Vec(0, 2, 1), Z.neg))
  engine.placeBlock(new StickyPiston(new Vec(1, 2, 1), Z.neg))

  // Door blocks at Z=0 (start closed)
  engine.placeBlock(new Solid(new Vec(0, 1, 0)))
  engine.placeBlock(new Solid(new Vec(1, 1, 0)))
  engine.placeBlock(new Solid(new Vec(0, 2, 0)))
  engine.placeBlock(new Solid(new Vec(1, 2, 0)))

  // Solid blocks for dust step-up ladder
  // Step 1: solids at (x, 1, 3) for dust at (x, 2, 3)
  engine.placeBlock(new Solid(new Vec(0, 1, 3)))
  engine.placeBlock(new Solid(new Vec(1, 1, 3)))
  
  // Step 2: solids at (x, 2, 2) for dust at (x, 3, 2)
  engine.placeBlock(new Solid(new Vec(0, 2, 2)))
  engine.placeBlock(new Solid(new Vec(1, 2, 2)))

  // Dust network
  // Base level (Y=1) - powers bottom pistons directly
  engine.placeBlock(new Dust(new Vec(0, 1, 2)))
  engine.placeBlock(new Dust(new Vec(1, 1, 2)))
  
  // Intermediate level (Y=2) - step-up connection
  engine.placeBlock(new Dust(new Vec(0, 2, 3)))
  engine.placeBlock(new Dust(new Vec(1, 2, 3)))
  
  // Top level (Y=3) - quasi-connectivity for top pistons
  engine.placeBlock(new Dust(new Vec(0, 3, 2)))
  engine.placeBlock(new Dust(new Vec(1, 3, 2)))

  // Lever adjacent to dust network
  engine.placeBlock(new Lever(
    new Vec(-1, 1, 2),
    Y.neg,
    new Vec(-1, 0, 2)
  ))
}

export const DOOR_POSITIONS = [
  new Vec(0, 1, 0),
  new Vec(1, 1, 0),
  new Vec(0, 2, 0),
  new Vec(1, 2, 0),
]

export const LEVER_POS = new Vec(-1, 1, 2)
