import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { Vec, type World, type Block } from "@ordo/engine"

const BLOCK_SIZE = 1
const HALF = BLOCK_SIZE / 2

const COLORS = {
  solid: 0x555566,
  solidPowered: 0x884444,
  solidStrong: 0xaa3333,
  slime: 0x7fbf4f,
  lever: 0x8b5a2b,
  leverOn: 0xffcc00,
  dust: 0x330000,
  dustOn: 0xff2222,
  torch: 0x664422,
  torchLit: 0xff8800,
  repeater: 0x555555,
  repeaterOn: 0xff4444,
  piston: 0x996633,
  pistonHead: 0xaa8844,
  observer: 0x666677,
  observerFace: 0x884466,
  redstoneBlock: 0xcc2222,
  button: 0x887766,
  pressurePlate: 0x887766,
  comparator: 0x555555,
  grid: 0x222233
}

export class Visualizer {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private controls: OrbitControls
  private blockMeshes: Map<string, THREE.Object3D> = new Map()
  private raycaster = new THREE.Raycaster()
  private mouse = new THREE.Vector2()
  private gridHelper: THREE.GridHelper

  onInteract: ((pos: Vec) => void) | null = null
  onPlace: ((pos: Vec) => void) | null = null
  onRemove: ((pos: Vec) => void) | null = null

  constructor(
    private container: HTMLElement,
    private world: World
  ) {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0a0a0f)

    this.camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    )
    this.camera.position.set(8, 6, 8)

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(this.renderer.domElement)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.05
    this.controls.target.set(2, 0, 0)

    // Lighting
    const ambient = new THREE.AmbientLight(0x404050, 0.6)
    this.scene.add(ambient)

    const directional = new THREE.DirectionalLight(0xffeedd, 1.2)
    directional.position.set(10, 20, 10)
    directional.castShadow = true
    directional.shadow.mapSize.width = 2048
    directional.shadow.mapSize.height = 2048
    directional.shadow.camera.near = 1
    directional.shadow.camera.far = 50
    directional.shadow.camera.left = -20
    directional.shadow.camera.right = 20
    directional.shadow.camera.top = 20
    directional.shadow.camera.bottom = -20
    this.scene.add(directional)

    const fill = new THREE.DirectionalLight(0x8888ff, 0.3)
    fill.position.set(-5, 5, -5)
    this.scene.add(fill)

    // Grid
    this.gridHelper = new THREE.GridHelper(40, 40, COLORS.grid, COLORS.grid)
    this.gridHelper.position.y = -0.5
    this.scene.add(this.gridHelper)

    // Events
    window.addEventListener("resize", this.onResize)
    this.renderer.domElement.addEventListener("click", this.onClick)

    this.update()
  }

  private onResize = () => {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  private onClick = (event: MouseEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    this.raycaster.setFromCamera(this.mouse, this.camera)
    const meshes = Array.from(this.blockMeshes.values())
    const intersects = this.raycaster.intersectObjects(meshes, true)

    if (intersects.length > 0) {
      const hit = intersects[0]
      const blockMesh = this.findBlockMesh(hit.object)
      if (blockMesh) {
        const posKey = blockMesh.userData.posKey as string
        const [x, y, z] = posKey.split(",").map(Number)
        const pos = new Vec(x, y, z)

        if (event.altKey && this.onRemove) {
          this.onRemove(pos)
        } else if (event.shiftKey && this.onPlace) {
          // Place adjacent to hit face
          const normal = hit.face?.normal
          if (normal) {
            const worldNormal = normal.clone().applyQuaternion(hit.object.getWorldQuaternion(new THREE.Quaternion()))
            const newPos = new Vec(
              Math.round(x + worldNormal.x),
              Math.round(y + worldNormal.y),
              Math.round(z + worldNormal.z)
            )
            this.onPlace(newPos)
          }
        } else if (this.onInteract) {
          this.onInteract(pos)
        }
      }
    } else if (event.shiftKey && this.onPlace) {
      // Raycast against grid plane
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.5)
      const intersection = new THREE.Vector3()
      this.raycaster.ray.intersectPlane(plane, intersection)
      if (intersection) {
        const pos = new Vec(
          Math.round(intersection.x),
          0,
          Math.round(intersection.z)
        )
        this.onPlace(pos)
      }
    }
  }

  private findBlockMesh(obj: THREE.Object3D): THREE.Object3D | null {
    let current: THREE.Object3D | null = obj
    while (current) {
      if (current.userData.posKey) return current
      current = current.parent
    }
    return null
  }

  update() {
    // Clear old meshes
    for (const mesh of this.blockMeshes.values()) {
      this.scene.remove(mesh)
      this.disposeMesh(mesh)
    }
    this.blockMeshes.clear()

    // Render all blocks
    this.iterateBlocks((pos, block) => {
      const mesh = this.createBlockMesh(block)
      if (mesh) {
        mesh.position.set(pos.x, pos.y, pos.z)
        mesh.userData.posKey = `${pos.x},${pos.y},${pos.z}`
        this.scene.add(mesh)
        this.blockMeshes.set(`${pos.x},${pos.y},${pos.z}`, mesh)
      }
    })
  }

  private iterateBlocks(callback: (pos: { x: number; y: number; z: number }, block: Block) => void) {
    // Scan a reasonable area
    for (let x = -10; x <= 20; x++) {
      for (let y = -5; y <= 10; y++) {
        for (let z = -10; z <= 20; z++) {
          const pos = new Vec(x, y, z)
          const block = this.world.getBlock(pos)
          if (block) {
            callback({ x, y, z }, block)
          }
        }
      }
    }
  }

  private createBlockMesh(block: Block): THREE.Object3D | null {
    switch (block.type) {
      case "solid":
        return this.createSolidMesh(block)
      case "slime":
        return this.createSlimeMesh(block)
      case "lever":
        return this.createLeverMesh(block)
      case "dust":
        return this.createDustMesh(block)
      case "torch":
        return this.createTorchMesh(block)
      case "repeater":
        return this.createRepeaterMesh(block)
      case "piston":
      case "sticky-piston":
        return this.createPistonMesh(block)
      case "observer":
        return this.createObserverMesh(block)
      case "redstone-block":
        return this.createRedstoneBlockMesh()
      case "button":
        return this.createButtonMesh(block)
      case "pressure-plate":
        return this.createPressurePlateMesh(block)
      case "comparator":
        return this.createComparatorMesh(block)
      default:
        return null
    }
  }

  private createSolidMesh(block: { powerState: string }): THREE.Mesh {
    const color =
      block.powerState === "strongly-powered"
        ? COLORS.solidStrong
        : block.powerState === "weakly-powered"
          ? COLORS.solidPowered
          : COLORS.solid
    const geo = new THREE.BoxGeometry(BLOCK_SIZE * 0.95, BLOCK_SIZE * 0.95, BLOCK_SIZE * 0.95)
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.8,
      metalness: 0.1
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }

  private createSlimeMesh(block: { powerState: string }): THREE.Mesh {
    const geo = new THREE.BoxGeometry(BLOCK_SIZE * 0.9, BLOCK_SIZE * 0.9, BLOCK_SIZE * 0.9)
    const mat = new THREE.MeshStandardMaterial({
      color: COLORS.slime,
      roughness: 0.3,
      metalness: 0,
      transparent: true,
      opacity: 0.7
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }

  private createLeverMesh(block: { on: boolean; attachedFace: Vec }): THREE.Group {
    const group = new THREE.Group()

    // Base
    const baseGeo = new THREE.BoxGeometry(0.3, 0.1, 0.2)
    const baseMat = new THREE.MeshStandardMaterial({ color: COLORS.lever, roughness: 0.9 })
    const base = new THREE.Mesh(baseGeo, baseMat)
    base.position.y = -HALF + 0.05
    group.add(base)

    // Handle
    const handleGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.35)
    const handleMat = new THREE.MeshStandardMaterial({
      color: block.on ? COLORS.leverOn : 0x444444,
      roughness: 0.6,
      emissive: block.on ? 0xffaa00 : 0x000000,
      emissiveIntensity: block.on ? 0.5 : 0
    })
    const handle = new THREE.Mesh(handleGeo, handleMat)
    handle.position.y = block.on ? -0.25 : -0.3
    handle.rotation.z = block.on ? -0.5 : 0.5
    group.add(handle)

    group.castShadow = true
    return group
  }

  private createDustMesh(block: { pos: Vec; signalStrength: number; shape: string }): THREE.Group {
    const group = new THREE.Group()
    const intensity = block.signalStrength / 15
    const color = new THREE.Color().lerpColors(
      new THREE.Color(COLORS.dust),
      new THREE.Color(COLORS.dustOn),
      intensity
    )

    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.5,
      emissive: color,
      emissiveIntensity: intensity * 0.8
    })

    // Compute connections
    const connections = this.getDustConnections(block.pos)

    // If dot mode and no connections, render as dot
    if (block.shape === "dot" && connections.length === 0) {
      const geo = new THREE.CylinderGeometry(0.15, 0.15, 0.03, 16)
      const dot = new THREE.Mesh(geo, mat)
      dot.position.y = -HALF + 0.02
      group.add(dot)
      return group
    }

    // If no connections, show cross (default)
    if (connections.length === 0) {
      group.add(this.createDustLine(mat.clone(), 0))
      group.add(this.createDustLine(mat.clone(), Math.PI / 2))
      return group
    }

    // Render lines based on connections
    const hasNegX = connections.some(c => c.x < 0)
    const hasPosX = connections.some(c => c.x > 0)
    const hasNegZ = connections.some(c => c.z < 0)
    const hasPosZ = connections.some(c => c.z > 0)

    // Center dot
    const centerGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.025, 8)
    const center = new THREE.Mesh(centerGeo, mat.clone())
    center.position.y = -HALF + 0.02
    group.add(center)

    // Arms
    if (hasNegX) group.add(this.createDustArm(mat.clone(), -1, 0))
    if (hasPosX) group.add(this.createDustArm(mat.clone(), 1, 0))
    if (hasNegZ) group.add(this.createDustArm(mat.clone(), 0, -1))
    if (hasPosZ) group.add(this.createDustArm(mat.clone(), 0, 1))

    return group
  }

  private createDustLine(mat: THREE.MeshStandardMaterial, rotY: number): THREE.Mesh {
    const geo = new THREE.BoxGeometry(0.8, 0.02, 0.12)
    const line = new THREE.Mesh(geo, mat)
    line.rotation.y = rotY
    line.position.y = -HALF + 0.02
    return line
  }

  private createDustArm(mat: THREE.MeshStandardMaterial, dx: number, dz: number): THREE.Mesh {
    const geo = new THREE.BoxGeometry(0.4, 0.02, 0.12)
    const arm = new THREE.Mesh(geo, mat)
    arm.position.set(dx * 0.2, -HALF + 0.02, dz * 0.2)
    arm.rotation.y = dz !== 0 ? Math.PI / 2 : 0
    return arm
  }

  private getDustConnections(pos: Vec): { x: number; z: number }[] {
    const connections: { x: number; z: number }[] = []
    const directions = [
      { x: 1, z: 0 },
      { x: -1, z: 0 },
      { x: 0, z: 1 },
      { x: 0, z: -1 }
    ]

    for (const dir of directions) {
      const adjPos = new Vec(pos.x + dir.x, pos.y, pos.z + dir.z)
      const adjBlock = this.world.getBlock(adjPos)

      // Direct connection to dust, lever, torch
      if (adjBlock?.type === "dust" || adjBlock?.type === "lever" || adjBlock?.type === "torch") {
        connections.push(dir)
        continue
      }

      // Repeater front/back
      if (adjBlock?.type === "repeater") {
        const facing = (adjBlock as any).facing
        const backX = adjBlock.pos.x - facing.x
        const backZ = adjBlock.pos.z - facing.z
        const frontX = adjBlock.pos.x + facing.x
        const frontZ = adjBlock.pos.z + facing.z
        if ((pos.x === backX && pos.z === backZ) || (pos.x === frontX && pos.z === frontZ)) {
          connections.push(dir)
          continue
        }
      }

      // Comparator front/back
      if (adjBlock?.type === "comparator") {
        const facing = (adjBlock as any).facing
        const backX = adjBlock.pos.x - facing.x
        const backZ = adjBlock.pos.z - facing.z
        const frontX = adjBlock.pos.x + facing.x
        const frontZ = adjBlock.pos.z + facing.z
        if ((pos.x === backX && pos.z === backZ) || (pos.x === frontX && pos.z === frontZ)) {
          connections.push(dir)
          continue
        }
      }

      // Observer back
      if (adjBlock?.type === "observer") {
        const facing = (adjBlock as any).facing
        const backX = adjBlock.pos.x - facing.x
        const backZ = adjBlock.pos.z - facing.z
        if (pos.x === backX && pos.z === backZ) {
          connections.push(dir)
          continue
        }
      }

      // Step-down: dust below adjacent air
      if (!adjBlock || adjBlock.type !== "solid") {
        const belowPos = new Vec(adjPos.x, adjPos.y - 1, adjPos.z)
        const belowBlock = this.world.getBlock(belowPos)
        if (belowBlock?.type === "dust") {
          connections.push(dir)
          continue
        }
      }

      // Step-up: dust on top of adjacent solid
      if (adjBlock?.type === "solid") {
        const abovePos = new Vec(adjPos.x, adjPos.y + 1, adjPos.z)
        const aboveBlock = this.world.getBlock(abovePos)
        if (aboveBlock?.type === "dust") {
          // Check if not blocked by solid above current dust
          const aboveCurrent = new Vec(pos.x, pos.y + 1, pos.z)
          const blockAbove = this.world.getBlock(aboveCurrent)
          if (blockAbove?.type !== "solid") {
            connections.push(dir)
          }
        }
      }
    }

    return connections
  }

  private createTorchMesh(block: { lit: boolean }): THREE.Group {
    const group = new THREE.Group()

    // Stick
    const stickGeo = new THREE.BoxGeometry(0.1, 0.4, 0.1)
    const stickMat = new THREE.MeshStandardMaterial({ color: COLORS.torch, roughness: 0.9 })
    const stick = new THREE.Mesh(stickGeo, stickMat)
    stick.position.y = -0.15
    group.add(stick)

    // Flame
    const flameGeo = new THREE.SphereGeometry(0.08, 8, 8)
    const flameMat = new THREE.MeshStandardMaterial({
      color: block.lit ? COLORS.torchLit : 0x333333,
      emissive: block.lit ? 0xff6600 : 0x000000,
      emissiveIntensity: block.lit ? 1.5 : 0,
      roughness: 0.3
    })
    const flame = new THREE.Mesh(flameGeo, flameMat)
    flame.position.y = 0.1
    group.add(flame)

    if (block.lit) {
      const light = new THREE.PointLight(0xff6600, 0.8, 4)
      light.position.y = 0.1
      group.add(light)
    }

    group.castShadow = true
    return group
  }

  private createRepeaterMesh(block: { outputOn: boolean; locked: boolean; delay: number; facing: Vec }): THREE.Group {
    const group = new THREE.Group()

    // Base
    const baseGeo = new THREE.BoxGeometry(0.9, 0.1, 0.9)
    const baseMat = new THREE.MeshStandardMaterial({ color: COLORS.repeater, roughness: 0.8 })
    const base = new THREE.Mesh(baseGeo, baseMat)
    base.position.y = -HALF + 0.05
    group.add(base)

    // Torches (2)
    const torchColor = block.outputOn ? COLORS.repeaterOn : 0x444444
    const torchEmissive = block.outputOn ? 0xff2222 : 0x000000

    const torch1Geo = new THREE.BoxGeometry(0.1, 0.15, 0.1)
    const torch1Mat = new THREE.MeshStandardMaterial({
      color: torchColor,
      emissive: torchEmissive,
      emissiveIntensity: block.outputOn ? 0.8 : 0
    })
    const torch1 = new THREE.Mesh(torch1Geo, torch1Mat)
    torch1.position.set(0, -0.35, -0.25)
    group.add(torch1)

    // Second torch position based on delay
    const delayOffset = -0.25 + ((block.delay - 2) / 6) * 0.5
    const torch2 = new THREE.Mesh(torch1Geo.clone(), torch1Mat.clone())
    torch2.position.set(0, -0.35, delayOffset)
    group.add(torch2)

    // Lock bars if locked
    if (block.locked) {
      const barGeo = new THREE.BoxGeometry(0.6, 0.08, 0.05)
      const barMat = new THREE.MeshStandardMaterial({ color: 0x333333 })
      const bar = new THREE.Mesh(barGeo, barMat)
      bar.position.y = -0.3
      group.add(bar)
    }

    // Rotate based on facing
    this.rotateByFacing(group, block.facing)

    group.castShadow = true
    return group
  }

  private createPistonMesh(block: { extended: boolean; facing: Vec; type: string }): THREE.Group {
    const group = new THREE.Group()
    const isSticky = block.type === "sticky-piston"

    // Body
    const bodyHeight = block.extended ? 0.75 : 1
    const bodyGeo = new THREE.BoxGeometry(0.9, bodyHeight * 0.9, 0.9)
    const bodyMat = new THREE.MeshStandardMaterial({ color: COLORS.piston, roughness: 0.7 })
    const body = new THREE.Mesh(bodyGeo, bodyMat)
    body.castShadow = true
    body.receiveShadow = true
    group.add(body)

    // Face plate
    const faceGeo = new THREE.BoxGeometry(0.85, 0.1, 0.85)
    const faceMat = new THREE.MeshStandardMaterial({
      color: isSticky ? COLORS.slime : COLORS.pistonHead,
      roughness: isSticky ? 0.3 : 0.6
    })
    const face = new THREE.Mesh(faceGeo, faceMat)
    face.position.y = block.extended ? 0.95 : 0.45
    group.add(face)

    // Rod when extended
    if (block.extended) {
      const rodGeo = new THREE.BoxGeometry(0.2, 0.5, 0.2)
      const rodMat = new THREE.MeshStandardMaterial({ color: COLORS.pistonHead, roughness: 0.6 })
      const rod = new THREE.Mesh(rodGeo, rodMat)
      rod.position.y = 0.65
      group.add(rod)
    }

    // Rotate to facing direction
    this.rotatePistonByFacing(group, block.facing)

    return group
  }

  private createObserverMesh(block: { outputOn: boolean; facing: Vec }): THREE.Group {
    const group = new THREE.Group()

    // Main body
    const bodyGeo = new THREE.BoxGeometry(0.95, 0.95, 0.95)
    const bodyMat = new THREE.MeshStandardMaterial({ color: COLORS.observer, roughness: 0.7 })
    const body = new THREE.Mesh(bodyGeo, bodyMat)
    body.castShadow = true
    body.receiveShadow = true
    group.add(body)

    // Face (detection side)
    const faceGeo = new THREE.BoxGeometry(0.6, 0.6, 0.02)
    const faceMat = new THREE.MeshStandardMaterial({ color: COLORS.observerFace, roughness: 0.5 })
    const face = new THREE.Mesh(faceGeo, faceMat)
    face.position.z = 0.48
    group.add(face)

    // Output indicator
    const outGeo = new THREE.BoxGeometry(0.2, 0.2, 0.02)
    const outMat = new THREE.MeshStandardMaterial({
      color: block.outputOn ? 0xff4444 : 0x444444,
      emissive: block.outputOn ? 0xff2222 : 0x000000,
      emissiveIntensity: block.outputOn ? 0.8 : 0
    })
    const out = new THREE.Mesh(outGeo, outMat)
    out.position.z = -0.48
    group.add(out)

    this.rotateByFacing(group, block.facing)

    return group
  }

  private createRedstoneBlockMesh(): THREE.Mesh {
    const geo = new THREE.BoxGeometry(0.95, 0.95, 0.95)
    const mat = new THREE.MeshStandardMaterial({
      color: COLORS.redstoneBlock,
      roughness: 0.4,
      emissive: 0xff2222,
      emissiveIntensity: 0.3
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }

  private createButtonMesh(block: { pressed: boolean }): THREE.Group {
    const group = new THREE.Group()

    const geo = new THREE.BoxGeometry(0.25, block.pressed ? 0.08 : 0.15, 0.15)
    const mat = new THREE.MeshStandardMaterial({
      color: block.pressed ? 0xaaaaaa : COLORS.button,
      roughness: 0.7
    })
    const btn = new THREE.Mesh(geo, mat)
    btn.position.set(0, -0.4, 0)
    group.add(btn)

    return group
  }

  private createPressurePlateMesh(block: { active: boolean }): THREE.Group {
    const group = new THREE.Group()

    const height = block.active ? 0.02 : 0.05
    const geo = new THREE.BoxGeometry(0.85, height, 0.85)
    const mat = new THREE.MeshStandardMaterial({
      color: block.active ? 0xaaaaaa : COLORS.pressurePlate,
      roughness: 0.6
    })
    const plate = new THREE.Mesh(geo, mat)
    plate.position.y = -HALF + height / 2
    plate.castShadow = true
    group.add(plate)

    return group
  }

  private createComparatorMesh(block: { outputSignal: number; mode: string; facing: Vec }): THREE.Group {
    const group = new THREE.Group()

    // Base
    const baseGeo = new THREE.BoxGeometry(0.9, 0.1, 0.9)
    const baseMat = new THREE.MeshStandardMaterial({ color: COLORS.comparator, roughness: 0.8 })
    const base = new THREE.Mesh(baseGeo, baseMat)
    base.position.y = -HALF + 0.05
    group.add(base)

    // Main torch (mode indicator)
    const mainColor = block.mode === "subtraction" ? 0xff4444 : 0x666666
    const mainGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12)
    const mainMat = new THREE.MeshStandardMaterial({
      color: mainColor,
      emissive: block.mode === "subtraction" ? 0xff2222 : 0x000000,
      emissiveIntensity: block.mode === "subtraction" ? 0.6 : 0
    })
    const mainTorch = new THREE.Mesh(mainGeo, mainMat)
    mainTorch.position.set(0, -0.35, 0)
    group.add(mainTorch)

    // Output torch
    const outIntensity = block.outputSignal / 15
    const outColor = new THREE.Color().lerpColors(
      new THREE.Color(0x333333),
      new THREE.Color(0xff4444),
      outIntensity
    )
    const outGeo = new THREE.BoxGeometry(0.08, 0.1, 0.08)
    const outMat = new THREE.MeshStandardMaterial({
      color: outColor,
      emissive: outColor,
      emissiveIntensity: outIntensity * 0.6
    })
    const outTorch = new THREE.Mesh(outGeo, outMat)
    outTorch.position.set(0, -0.35, 0.3)
    group.add(outTorch)

    this.rotateByFacing(group, block.facing)

    return group
  }

  private rotateByFacing(group: THREE.Group, facing: Vec) {
    if (facing.x === 1) group.rotation.y = -Math.PI / 2
    else if (facing.x === -1) group.rotation.y = Math.PI / 2
    else if (facing.z === -1) group.rotation.y = Math.PI
  }

  private rotatePistonByFacing(group: THREE.Group, facing: Vec) {
    if (facing.x === 1) group.rotation.z = -Math.PI / 2
    else if (facing.x === -1) group.rotation.z = Math.PI / 2
    else if (facing.y === -1) group.rotation.x = Math.PI
    else if (facing.z === 1) group.rotation.x = Math.PI / 2
    else if (facing.z === -1) group.rotation.x = -Math.PI / 2
  }

  private disposeMesh(obj: THREE.Object3D) {
    obj.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose())
        } else {
          child.material.dispose()
        }
      }
    })
  }

  start() {
    const animate = () => {
      requestAnimationFrame(animate)
      this.controls.update()
      this.renderer.render(this.scene, this.camera)
    }
    animate()
  }

  dispose() {
    window.removeEventListener("resize", this.onResize)
    this.renderer.domElement.removeEventListener("click", this.onClick)
    this.controls.dispose()
    this.renderer.dispose()
  }
}

