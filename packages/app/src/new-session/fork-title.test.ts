import { expect, test } from "bun:test"
import { forkPromptTitle } from "./composer-adapter"

test("names a fork from the submitted prompt on one line", () => {
  expect(forkPromptTitle("  Test an alternative\n\n and verify the results.  ")).toBe(
    "Test an alternative and verify the results.",
  )
  expect(forkPromptTitle(" \n ")).toBe("")
})

test("shortens a long fork title without splitting an emoji", () => {
  const text = `${"a".repeat(96)}🦊extra context`

  expect(forkPromptTitle(text)).toBe(`${"a".repeat(96)}...`)
})
