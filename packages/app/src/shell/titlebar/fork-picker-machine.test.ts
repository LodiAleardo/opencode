import { expect, test } from "bun:test"
import { forkPickerView, initialForkPicker, transitionForkPicker } from "./fork-picker-machine"

test("a failed picker can retry without accepting a stale page or settling after close", () => {
  const failed = transitionForkPicker(initialForkPicker, { type: "failed", attempt: 1 })
  expect(forkPickerView(failed)).toMatchObject({ failed: true, loading: false })

  const retry = transitionForkPicker(failed, { type: "retry" })
  expect(forkPickerView(retry)).toMatchObject({ failed: false, loading: true })
  expect(transitionForkPicker(retry, { type: "loaded", attempt: 1, history: [] })).toBe(retry)

  const closed = transitionForkPicker(retry, { type: "disposed" })
  expect(transitionForkPicker(closed, { type: "loaded", attempt: 2, history: [] })).toBe(closed)
})
