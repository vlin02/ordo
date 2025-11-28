import { Visualizer } from "./visualizer"
import {
  Engine,
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

function createDemoEngine(): Engine {
  const engine = new Engine()

  // Demo scene: lever → dust → repeater → piston
  engine.placeBlock(new Solid(new Vec(0, -1, 0)))
  engine.placeBlock(new Solid(new Vec(1, -1, 0)))
  engine.placeBlock(new Solid(new Vec(2, -1, 0)))
  engine.placeBlock(new Solid(new Vec(3, -1, 0)))
  engine.placeBlock(new Solid(new Vec(4, -1, 0)))

  engine.placeBlock(new Lever(new Vec(0, 0, 0), Y.neg, new Vec(0, -1, 0)))
  engine.placeBlock(new Dust(new Vec(1, 0, 0)))
  engine.placeBlock(new Dust(new Vec(2, 0, 0)))
  engine.placeBlock(new Repeater(new Vec(3, 0, 0), new Vec(1, 0, 0)))
  engine.placeBlock(new Piston(new Vec(4, 0, 0), new Vec(1, 0, 0)))

  // Torch attached to a block
  engine.placeBlock(new Solid(new Vec(0, 0, 2)))
  engine.placeBlock(new Torch(new Vec(0, 1, 2), Y.neg, new Vec(0, 0, 2)))

  // Target block for piston
  engine.placeBlock(new Solid(new Vec(5, 0, 0)))

  return engine
}

function loadEngineFromUrl(): Engine | null {
  try {
    const snapshot = snapshotFromUrl(window.location.href)
    if (!snapshot) {
      console.log("No snapshot in URL")
      return null
    }
    console.log("Loaded snapshot:", snapshot.tickCounter, "tick,", snapshot.blocks.length, "blocks")
    const engine = Engine.fromSnapshot(snapshot)
    console.log("Engine created, tick:", engine.getCurrentTick())
    return engine
  } catch (e) {
    console.error("Failed to load from URL:", e)
    return null
  }
}

const engine = loadEngineFromUrl() ?? createDemoEngine()

const container = document.getElementById("canvas-container")!
const visualizer = new Visualizer(container, engine)

// UI
const tickCounter = document.getElementById("tick-counter")!
const tickBtn = document.getElementById("tick-btn")!
const playBtn = document.getElementById("play-btn")!
const shareBtn = document.getElementById("share-btn")!

let playing = false
let playInterval: number | null = null

function updateTickDisplay() {
  tickCounter.textContent = String(engine.getCurrentTick())
}

tickBtn.addEventListener("click", () => {
  engine.tick()
  visualizer.update()
  updateTickDisplay()
})

playBtn.addEventListener("click", () => {
  playing = !playing
  playBtn.textContent = playing ? "⏸ Pause" : "▶ Play"

  if (playing) {
    playInterval = window.setInterval(() => {
      engine.tick()
      visualizer.update()
      updateTickDisplay()
    }, 100)
  } else if (playInterval) {
    clearInterval(playInterval)
    playInterval = null
  }
})

shareBtn.addEventListener("click", async () => {
  const url = snapshotToUrl(engine.toSnapshot(), window.location.origin + window.location.pathname)

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
  engine.interact(pos)
  visualizer.update()
  updateTickDisplay()
}

visualizer.onPlace = (pos) => {
  const block = createBlock(selectedBlock, pos)
  if (block) {
    engine.placeBlock(block)
    visualizer.update()
  }
}

visualizer.onRemove = (pos) => {
  engine.removeBlock(pos)
  visualizer.update()
}

function createBlock(type: string, pos: Vec) {
  switch (type) {
    case "solid":
      return new Solid(pos)
    case "lever":
      return new Lever(pos, Y.neg, pos.add(Y.neg))
    case "dust":
      return new Dust(pos)
    case "torch":
      return new Torch(pos, Y.neg, pos.add(Y.neg))
    case "repeater":
      return new Repeater(pos, new Vec(1, 0, 0))
    case "piston":
      return new Piston(pos, new Vec(1, 0, 0))
    default:
      return null
  }
}

visualizer.start()
updateTickDisplay()
