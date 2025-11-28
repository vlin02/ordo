import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { randomBytes } from "node:crypto"
import { formatProblem, type Problem } from "./writer.js"

function generateTestFile(problem: Problem): string {
  const tests = problem.testCases.map(tc => `  test.todo("${tc.name}")`).join("\n\n")
  return `import { describe, test } from "vitest"
import { createSolution } from "./solution"

describe("${problem.title}", () => {
${tests}
})
`
}

function generateSolutionFile(): string {
  return `import { Engine } from "@ordo/engine"

export function createSolution(): Engine {
  const engine = new Engine()
  return engine
}
`
}

function generateReadme(): string {
  return `# Solution

## Approach

## Components Used
`
}

export async function writeProblem(problem: Problem, name: string, outDir: string) {
  const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
  const hash = randomBytes(3).toString("hex")
  const dir = join(outDir, `${slug}-${hash}`)
  await mkdir(dir, { recursive: true })

  await Promise.all([
    writeFile(join(dir, "PROBLEM.md"), formatProblem(problem)),
    writeFile(join(dir, "problem.json"), JSON.stringify(problem, null, 2)),
    writeFile(join(dir, "solution.test.ts"), generateTestFile(problem)),
    writeFile(join(dir, "solution.ts"), generateSolutionFile()),
    writeFile(join(dir, "README.md"), generateReadme())
  ])

  return dir
}
