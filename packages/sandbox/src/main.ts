import { Visualizer } from "./visualizer"
import {
  World,
  Vec,
  Solid,
  Lever,
  Dust,
  Piston,
  Repeater,
  Torch,
  Y,
  snapshotToUrl,
  snapshotFromUrl
} from "@ordo/engine"

function createDemoWorld(): World {
  const world = new World()

  // Demo scene: lever → dust → repeater → piston
  world.solid(new Vec(0, -1, 0))
  world.solid(new Vec(1, -1, 0))
  world.solid(new Vec(2, -1, 0))
  world.solid(new Vec(3, -1, 0))
  world.solid(new Vec(4, -1, 0))

  world.lever(new Vec(0, 0, 0), Y.neg) // face pointing down to attach to block below
  world.dust(new Vec(1, 0, 0))
  world.dust(new Vec(2, 0, 0))
  world.repeater(new Vec(3, 0, 0), new Vec(1, 0, 0)) // facing +X
  world.piston(new Vec(4, 0, 0), new Vec(1, 0, 0)) // facing +X

  // Torch attached to a block
  world.solid(new Vec(0, 0, 2))
  world.torch(new Vec(0, 1, 2), Y.neg) // face pointing down to attach to block below

  // Target block for piston
  world.solid(new Vec(5, 0, 0))

  return world
}

function loadWorldFromUrl(): World | null {
  try {
    const snapshot = snapshotFromUrl(window.location.href)
    if (!snapshot) {
      console.log("No snapshot in URL")
      return null
    }
    console.log("Loaded snapshot:", snapshot.tickCounter, "tick,", snapshot.blocks.length, "blocks")
    const world = World.fromSnapshot(snapshot)
    console.log("World created, tick:", world.getCurrentTick())
    return world
  } catch (e) {
    console.error("Failed to load from URL:", e)
    return null
  }
}

const world = loadWorldFromUrl() ?? createDemoWorld()

const container = document.getElementById("canvas-container")!
const visualizer = new Visualizer(container, world)

// UI
const tickCounter = document.getElementById("tick-counter")!
const tickBtn = document.getElementById("tick-btn")!
const playBtn = document.getElementById("play-btn")!
const shareBtn = document.getElementById("share-btn")!

let playing = false
let playInterval: number | null = null

function updateTickDisplay() {
  tickCounter.textContent = String(world.getCurrentTick())
}

tickBtn.addEventListener("click", () => {
  world.tick()
  visualizer.update()
  updateTickDisplay()
})

playBtn.addEventListener("click", () => {
  playing = !playing
  playBtn.textContent = playing ? "⏸ Pause" : "▶ Play"

  if (playing) {
    playInterval = window.setInterval(() => {
      world.tick()
      visualizer.update()
      updateTickDisplay()
    }, 100)
  } else if (playInterval) {
    clearInterval(playInterval)
    playInterval = null
  }
})

shareBtn.addEventListener("click", async () => {
  const url = snapshotToUrl(world.toSnapshot(), window.location.origin + window.location.pathname)

  try {
    await navigator.clipboard.writeText(url)
    shareBtn.textContent = "✓ Copied!"
    setTimeout(() => {
      shareBtn.textContent = "Share"
    }, 2000)
  } catch {
    prompt("Copy this URL:", url)
  }
})

// Block palette
const palette = document.getElementById("block-palette")!
const blockTypes = [
  { id: "solid", color: "#666677", label: "S" },
  { id: "lever", color: "#8b5a2b", label: "L" },
  { id: "dust", color: "#ff4444", label: "D" },
  { id: "torch", color: "#ffaa00", label: "T" },
  { id: "repeater", color: "#777777", label: "R" },
  { id: "piston", color: "#996633", label: "P" }
]

let selectedBlock = "solid"

blockTypes.forEach(({ id, color, label }) => {
  const btn = document.createElement("button")
  btn.className = `btn block-btn ${id === selectedBlock ? "selected" : ""}`
  btn.style.background = color
  btn.textContent = label
  btn.title = id
  btn.addEventListener("click", () => {
    document.querySelectorAll(".block-btn").forEach(b => b.classList.remove("selected"))
    btn.classList.add("selected")
    selectedBlock = id
  })
  palette.appendChild(btn)
})

visualizer.onInteract = (pos) => {
  const block = world.getBlock(pos)
  if (block && "type" in block) {
    const t = block.type
    if (t === "lever" || t === "dust" || t === "repeater" || t === "button" || t === "comparator") {
      world.interact(block as any)
      visualizer.update()
      updateTickDisplay()
    }
  }
}

visualizer.onPlace = (pos) => {
  try {
    placeBlock(selectedBlock, pos)
    visualizer.update()
  } catch (e) {
    console.warn("Failed to place:", e)
  }
}

visualizer.onRemove = (pos) => {
  const block = world.getBlock(pos)
  if (block) {
    world.removeBlock(block)
    visualizer.update()
  }
}

function placeBlock(type: string, pos: Vec) {
  switch (type) {
    case "solid":
      world.solid(pos)
      break
    case "lever":
      world.lever(pos, Y.neg)
      break
    case "dust":
      world.dust(pos)
      break
    case "torch":
      world.torch(pos, Y.neg)
      break
    case "repeater":
      world.repeater(pos, new Vec(1, 0, 0))
      break
    case "piston":
      world.piston(pos, new Vec(1, 0, 0))
      break
  }
}

visualizer.start()
updateTickDisplay()
