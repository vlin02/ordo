import Anthropic from "@anthropic-ai/sdk"
import { SPEC } from "@ordo/engine"
import { z } from "zod"
import { zodToJsonSchema } from "zod-to-json-schema"
import { readFile } from "fs/promises"
import { join } from "path"

const TestCaseSchema = z.object({
  name: z.string().describe("Test name"),
  steps: z.array(z.string()).describe("Test steps")
})

export const ProblemSchema = z.object({
  title: z.string().describe("Problem title"),
  statement: z.string().describe("Problem statement"),
  testCases: z.array(TestCaseSchema).describe("List of test cases")
})

const TestCasesSchema = z.object({
  testCases: z.array(TestCaseSchema).describe("List of test cases")
})

export type TestCase = z.infer<typeof TestCaseSchema>
export type Problem = z.infer<typeof ProblemSchema>

export type File = { label: string; content: string }

export type WriterContext = {
  problem?: Problem
  files?: File[]
}

const CONTEXT_FILES = ["readme.md", "solution.test.ts", "solution.ts"] as const

export async function readContext(dir: string): Promise<WriterContext> {
  const raw = JSON.parse(await readFile(join(dir, "problem.json"), "utf-8"))
  
  const problem: Problem = {
    title: raw.title,
    statement: raw.statement ?? raw.description ?? "",
    testCases: raw.testCases ?? []
  }

  const files: File[] = []
  for (const name of CONTEXT_FILES) {
    try {
      files.push({ label: name, content: await readFile(join(dir, name), "utf-8") })
    } catch { /* optional */ }
  }

  return { problem, files: files.length ? files : undefined }
}

export function formatProblem(problem: Problem): string {
  const tests = problem.testCases
    .map(t => `test("${t.name}")\n${t.steps.map(s => `- ${s}`).join("\n")}`)
    .join("\n\n")

  return `# ${problem.title}

${problem.statement}

## Test Cases

${tests}
`
}

function problemPrompt(problemDescription: string): string {
  return `You are a Minecraft redstone problem writer creating a coding challenge.

You have access to the @ordo/engine library. Here is the full specification:

${SPEC}

Generate a complete problem specification for:

${problemDescription}

Be:
- Complete: covers all required behavior
- Unambiguous: only one valid interpretation
- Implementation independent: describes what, not how
- Succinct

Use the output_problem tool to output the result.`
}

function reviewTestsPrompt(problem: Problem): string {
  return `You are reviewing test cases for a Minecraft redstone coding challenge.

You have access to the @ordo/engine library. Here is the full specification:

${SPEC}

## Problem
Title: ${problem.title}
${problem.statement}

## Current Test Cases
${problem.testCases.map(t => `${t.name}:\n${t.steps.map(s => `  - ${s}`).join("\n")}`).join("\n\n")}

## Task
Review these test cases for loopholes AND density. Balance thoroughness with simplicity.

Look for loopholes:
- Edge cases not covered
- Timing assumptions that could be gamed
- State assumptions that could be bypassed
- Missing negative tests (things that should NOT happen)

Optimize for density:
- Each test should cover maximum unique behavior
- Avoid redundant tests that check the same thing
- Prefer fewer comprehensive tests over many narrow ones
- Combine related assertions into single tests where logical

Goal: Maximize coverage-to-test-count ratio. A fake solution should fail at least one test, but we don't need 20 tests when 8 well-designed ones suffice.

Output improved test cases using the output_test_cases tool.`
}

async function streamWithThinking(
  client: Anthropic,
  params: Anthropic.MessageCreateParams,
  label: string
): Promise<Anthropic.Message> {
  const stream = await client.messages.stream({
    ...params,
    stream: true
  } as Anthropic.MessageStreamParams)

  process.stdout.write(`\n[${label}] Thinking: `)
  
  for await (const event of stream) {
    if (event.type === "content_block_delta") {
      const delta = event.delta
      if ("thinking" in delta) {
        process.stdout.write(delta.thinking)
      }
    }
  }
  
  process.stdout.write("\n")
  
  return await stream.finalMessage()
}

export async function generate(
  client: Anthropic,
  problemDescription: string,
  testIterations = 2
): Promise<Problem> {
  const response = await streamWithThinking(client, {
    model: "claude-opus-4-5-20251101",
    max_tokens: 16000,
    thinking: { type: "enabled", budget_tokens: 12000 },
    messages: [{ role: "user", content: problemPrompt(problemDescription) }],
    tools: [{
      name: "output_problem",
      description: "Output the problem specification",
      input_schema: zodToJsonSchema(ProblemSchema) as Anthropic.Tool.InputSchema
    }],
    tool_choice: { type: "auto" }
  }, "Problem Generation")

  const toolUse = response.content.find(b => b.type === "tool_use")
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("Expected tool use")
  
  let problem = ProblemSchema.parse(toolUse.input) as Problem
  console.log(`\n[generate] Initial problem: "${problem.title}" with ${problem.testCases.length} tests`)

  for (let i = 0; i < testIterations; i++) {
    const reviewResponse = await streamWithThinking(client, {
      model: "claude-opus-4-5-20251101",
      max_tokens: 24000,
      thinking: { type: "enabled", budget_tokens: 18000 },
      messages: [{ role: "user", content: reviewTestsPrompt(problem) }],
      tools: [{
        name: "output_test_cases",
        description: "Output the reviewed test cases",
        input_schema: zodToJsonSchema(TestCasesSchema) as Anthropic.Tool.InputSchema
      }],
      tool_choice: { type: "auto" }
    }, `Test Review ${i + 1}/${testIterations}`)

    const reviewToolUse = reviewResponse.content.find(b => b.type === "tool_use")
    if (!reviewToolUse || reviewToolUse.type !== "tool_use") throw new Error("Expected tool use")
    
    const { testCases } = TestCasesSchema.parse(reviewToolUse.input) as { testCases: TestCase[] }
    problem = { ...problem, testCases }
    console.log(`[generate] Review ${i + 1} complete: ${testCases.length} tests`)
  }

  return problem
}

function formatContext(ctx: WriterContext): string {
  let content = ""

  if (ctx.problem) {
    content += `## Current Problem\n${formatProblem(ctx.problem)}\n`
  }

  if (ctx.files?.length) {
    content += `## Files\n`
    for (const file of ctx.files) {
      content += `\n### ${file.label}\n\`\`\`\n${file.content}\n\`\`\`\n`
    }
  }

  return content
}

function writerPrompt(prompt: string, ctx: WriterContext): string {
  const context = formatContext(ctx)

  return `You are a Minecraft redstone problem writer creating a coding challenge.

You have access to the @ordo/engine library. Here is the full specification:

${SPEC}
${context}
## Task
${prompt}

Be:
- Complete: covers all required behavior
- Unambiguous: only one valid interpretation
- Implementation independent: describes what, not how
- Succinct

Use the output_problem tool to output the result.`
}

export async function write(
  client: Anthropic,
  prompt: string,
  ctx: WriterContext = {}
): Promise<Problem> {
  const response = await streamWithThinking(client, {
    model: "claude-opus-4-5-20251101",
    max_tokens: 16000,
    thinking: { type: "enabled", budget_tokens: 12000 },
    messages: [{ role: "user", content: writerPrompt(prompt, ctx) }],
    tools: [{
      name: "output_problem",
      description: "Output the problem specification",
      input_schema: zodToJsonSchema(ProblemSchema) as Anthropic.Tool.InputSchema
    }],
    tool_choice: { type: "auto" }
  }, ctx.problem ? "Problem Edit" : "Problem Generation")

  const toolUse = response.content.find(b => b.type === "tool_use")
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("Expected tool use")

  return ProblemSchema.parse(toolUse.input) as Problem
}
