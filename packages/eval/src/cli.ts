#!/usr/bin/env node
import "dotenv/config"
import { parseArgs } from "node:util"
import { join } from "node:path"
import Anthropic from "@anthropic-ai/sdk"
import { generate } from "./writer.js"
import { writeProblem } from "./problem.js"

const DEFAULT_OUT = join(import.meta.dirname, "problems")

async function cmdGenerate(description: string, iterations: number, name: string | undefined, outDir: string) {
  const client = new Anthropic()
  const problem = await generate(client, description, iterations)
  const dir = await writeProblem(problem, name ?? problem.title, outDir)
  console.log(`\nWrote problem to: ${dir}`)
}

function printHelp() {
  console.log(`
Usage: pnpm cli <command> [options]

Commands:
  generate <description>   Generate a new problem spec from description
    --iterations, -i       Number of test review iterations (default: 2)
    --name, -n             Problem directory name (default: problem title)
    --out, -o              Output directory (default: src/problems)

Examples:
  pnpm cli generate "A 2x2 flush piston door" --iterations 3
  pnpm cli generate "A simple lever circuit" --out $(mktemp -d)
`)
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      iterations: { type: "string", short: "i", default: "2" },
      name: { type: "string", short: "n" },
      out: { type: "string", short: "o" },
      help: { type: "boolean", short: "h" }
    }
  })

  if (values.help || positionals.length === 0) {
    printHelp()
    process.exit(0)
  }

  const [command, ...args] = positionals

  switch (command) {
    case "generate": {
      const description = args.join(" ")
      if (!description) {
        console.error("Error: description required")
        process.exit(1)
      }
      await cmdGenerate(description, parseInt(values.iterations!, 10), values.name, values.out ?? DEFAULT_OUT)
      break
    }
    default:
      console.error(`Unknown command: ${command}`)
      printHelp()
      process.exit(1)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
