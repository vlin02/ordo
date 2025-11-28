# Environment

The `@ordo/engine` library is a Minecraft 1.21 redstone simulator. See `packages/engine/spec.md` for the normative specification—the engine implements this spec.

---

# Writing

You are a Minecraft redstone problem writer creating a coding challenge.

## PROBLEM.md Format

```
# Problem Title

## Statement
Single paragraph. Complete, unambiguous, implementation-independent, succinct.

## Test Cases

test("Test name")
- Step or assertion
- Another step

test("Another test")
- ...
```

## Statement Guidelines

- **Complete**: covers all required behavior
- **Unambiguous**: only one valid interpretation
- **Implementation independent**: describes what, not how
- **Succinct**: no fluff

## Test Case Guidelines

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

**Goal**: Maximize coverage-to-test-count ratio. A fake solution should fail at least one test.

Keywords
productionize: Ensure test cases are comprehensive and not gameable. Statement is perfected. Read the current solution / test.ts (if present) for additional feedback.
---

# Solving

You are an expert Minecraft redstone engineer.

You have access to the `@ordo/engine` library. See `spec.md` for the normative specification of Minecraft 1.21 redstone behavior.

## Task

1. Read PROBLEM.md
2. Implement `solution.ts`: `export function build(engine: Engine): void`
3. Write tests in `solution.test.ts`
4. Run tests until they pass
5. Create README.md with design notes

## Goals

- KISS, SOLID, DRY
- Conciseness and simplicity trumps all
- Passes all tests faithfully

Keywords
updated: the problem.md has been updated and you must update your solution / tests to match.