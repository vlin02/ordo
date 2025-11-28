import "dotenv/config"
import { Sandbox } from "@e2b/code-interpreter"
import { GoogleGenerativeAI, SchemaType, FunctionCallingMode, Part, FunctionDeclaration } from "@google/generative-ai"
import { readFile } from "fs/promises"
import { join } from "path"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const SYSTEM_PROMPT = `You are an expert Minecraft redstone engineer solving coding challenges.

You have access to the @ordo/engine library for building and testing redstone contraptions.

## Available Tools

You can use these tools to solve the problem:
- read_file: Read files in your workspace
- write_file: Create or update files (solution.ts, solution.test.ts, helpers, etc)
- run_command: Execute shell commands (npm install, npm test, etc)
- list_files: See what files exist

## Your Task

1. Read and understand the PROBLEM.md specification
2. Design a solution that satisfies all requirements
3. Implement solution.ts with the required export:
   export function build(engine: Engine): void
4. Write comprehensive tests in solution.test.ts
5. Run tests and iterate until they pass

## Guidelines

- Follow KISS, DRY, SOLID principles
- Optimize for simplicity and correctness
- Ensure all tests from PROBLEM.md are covered
- Tests should give high confidence of correctness
- You may create helper files if needed

## Completion

When done, create a README.md summarizing:
- Your design approach
- Key implementation details
- Test coverage

Signal completion when all tests pass.`

interface SolutionResult {
  files: Record<string, string>
  readme: string
  success: boolean
  error?: string
}

export async function solve(problemPath: string): Promise<SolutionResult> {
  const sbx = await Sandbox.create()
  
  try {
    // Read PROBLEM.md
    const problemSpec = await readFile(join(problemPath, "PROBLEM.md"), "utf-8")
    
    // Read spec.md from engine package
    const specPath = join(process.cwd(), "../engine/spec.md")
    const engineSpec = await readFile(specPath, "utf-8")
    
    // Upload spec to sandbox
    await sbx.files.write("/workspace/spec.md", engineSpec)
    await sbx.files.write("/workspace/PROBLEM.md", problemSpec)
    
    // Setup workspace - install engine package
    await sbx.runCode(`
import subprocess
import os

os.chdir('/workspace')

# Create package.json
package_json = """
{
  "name": "solution",
  "type": "module",
  "dependencies": {
    "@ordo/engine": "file:../engine",
    "vitest": "^4.0.14"
  }
}
"""

with open('package.json', 'w') as f:
    f.write(package_json)
`)
    
    // Copy engine package to sandbox
    const enginePath = join(process.cwd(), "../engine")
    const engineFiles = await getEngineFiles(enginePath)
    
    for (const [relativePath, content] of Object.entries(engineFiles)) {
      await sbx.files.write(`/engine/${relativePath}`, content)
    }
    
    // Initialize Gemini with function calling
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
      systemInstruction: SYSTEM_PROMPT
    })
    
    const functionDeclarations: FunctionDeclaration[] = [
      {
        name: "read_file",
        description: "Read contents of a file in the workspace",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            path: { type: SchemaType.STRING, description: "Path to file" }
          },
          required: ["path"]
        }
      },
      {
        name: "write_file",
        description: "Write or update a file in the workspace",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            path: { type: SchemaType.STRING, description: "Path to file" },
            content: { type: SchemaType.STRING, description: "File contents" }
          },
          required: ["path", "content"]
        }
      },
      {
        name: "run_command",
        description: "Run a shell command",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            command: { type: SchemaType.STRING, description: "Shell command to execute" }
          },
          required: ["command"]
        }
      },
      {
        name: "list_files",
        description: "List files in workspace",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {}
        }
      },
      {
        name: "complete",
        description: "Signal that the solution is complete and all tests pass",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {}
        }
      }
    ]
    
    const tools = [{ functionDeclarations }]
    
    const chat = model.startChat({
      tools,
      toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.ANY } }
    })
    
    let iteration = 0
    const maxIterations = 20
    let completed = false
    
    let result = await chat.sendMessage(problemSpec)
    
    while (iteration < maxIterations && !completed) {
      iteration++
      
      const functionCalls = result.response.functionCalls()
      if (!functionCalls || functionCalls.length === 0) {
        break
      }
      
      const functionResponses: Part[] = []
      
      for (const call of functionCalls) {
        let response: Record<string, unknown>
        
        switch (call.name) {
          case "read_file": {
            const path = (call.args as { path: string }).path
            try {
              const content = await sbx.files.read(`/workspace/${path}`)
              response = { content }
            } catch {
              response = { error: `File not found: ${path}` }
            }
            break
          }
          
          case "write_file": {
            const args = call.args as { path: string; content: string }
            await sbx.files.write(`/workspace/${args.path}`, args.content)
            response = { success: true }
            break
          }
          
          case "run_command": {
            const command = (call.args as { command: string }).command
            const exec = await sbx.runCode(`
import subprocess
result = subprocess.run(
  ${JSON.stringify(command)},
  shell=True,
  cwd='/workspace',
  capture_output=True,
  text=True
)
print(result.stdout)
print(result.stderr, file=__import__('sys').stderr)
result.returncode
`)
            response = {
              stdout: exec.logs.stdout.join("\n"),
              stderr: exec.logs.stderr.join("\n"),
              exitCode: exec.results[0]
            }
            break
          }
          
          case "list_files": {
            const exec = await sbx.runCode(`
import os
files = []
for root, dirs, filenames in os.walk('/workspace'):
    for f in filenames:
        files.append(os.path.relpath(os.path.join(root, f), '/workspace'))
files
`)
            response = { files: exec.results[0] }
            break
          }
          
          case "complete": {
            completed = true
            response = { success: true }
            break
          }
          
          default:
            response = { error: `Unknown function: ${call.name}` }
        }
        
        functionResponses.push({
          functionResponse: {
            name: call.name,
            response
          }
        })
      }
      
      result = await chat.sendMessage(functionResponses)
    }
    
    // Extract final files
    const files: Record<string, string> = {}
    
    try {
      const solutionTs = await sbx.files.read("/workspace/solution.ts")
      files["solution.ts"] = solutionTs
    } catch {
      // File might not exist
    }
    
    try {
      const testTs = await sbx.files.read("/workspace/solution.test.ts")
      files["solution.test.ts"] = testTs
    } catch {
      // File might not exist
    }
    
    try {
      const readme = await sbx.files.read("/workspace/README.md")
      files["README.md"] = readme
    } catch {
      // File might not exist
    }
    
    return {
      files,
      readme: files["README.md"] || "No README generated",
      success: completed,
      error: completed ? undefined : "Max iterations reached without completion"
    }
    
  } finally {
    await sbx.kill()
  }
}

async function getEngineFiles(enginePath: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {}
  
  files["package.json"] = await readFile(join(enginePath, "package.json"), "utf-8")
  files["spec.md"] = await readFile(join(enginePath, "spec.md"), "utf-8")
  
  // TODO: Copy dist/ folder recursively or publish to npm registry
  
  return files
}
