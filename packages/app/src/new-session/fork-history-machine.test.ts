import { expect, test } from "bun:test"
import {
  FORK_HISTORY_PAGE_SIZE,
  forkHistoryView,
  initialForkHistory,
  transitionForkHistory,
} from "./fork-history-machine"

test("an initial timeout reveals the retry state and a late result cannot settle the retry", () => {
  expect(forkHistoryView(initialForkHistory)).toEqual({ limit: undefined, loading: true, failed: false })

  const failed = transitionForkHistory(initialForkHistory, { type: "load.timed-out", attempt: 1 })
  expect(forkHistoryView(failed)).toEqual({ limit: undefined, loading: false, failed: true })

  const retry = transitionForkHistory(failed, { type: "load.requested", limit: FORK_HISTORY_PAGE_SIZE })
  expect(transitionForkHistory(retry, { type: "load.succeeded", attempt: 1 })).toBe(retry)

  const ready = transitionForkHistory(retry, { type: "load.succeeded", attempt: 2 })
  expect(forkHistoryView(ready)).toEqual({ limit: FORK_HISTORY_PAGE_SIZE, loading: false, failed: false })
})

test("an earlier-page load claims the click, keeps the current page on failure, and cancels on disposal", () => {
  const ready = transitionForkHistory(initialForkHistory, { type: "load.succeeded", attempt: 1 })
  const request = { type: "load.requested", limit: FORK_HISTORY_PAGE_SIZE * 2 } as const
  const loading = transitionForkHistory(ready, request)

  expect(forkHistoryView(loading)).toEqual({ limit: FORK_HISTORY_PAGE_SIZE, loading: true, failed: false })
  expect(transitionForkHistory(loading, request)).toBe(loading)

  const failed = transitionForkHistory(loading, { type: "load.failed", attempt: 2 })
  expect(forkHistoryView(failed)).toEqual({ limit: FORK_HISTORY_PAGE_SIZE, loading: false, failed: true })

  const retry = transitionForkHistory(failed, request)
  const disposed = transitionForkHistory(retry, { type: "disposed" })
  expect(transitionForkHistory(disposed, { type: "load.succeeded", attempt: 3 })).toBe(disposed)
  expect(transitionForkHistory(disposed, request)).toBe(disposed)
})
