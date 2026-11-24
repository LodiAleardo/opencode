export const FORK_HISTORY_PAGE_SIZE = 40

export const FORK_HISTORY_TIMEOUT_MS = 30_000

export type ForkHistoryState =
  | { readonly status: "loading"; readonly attempt: number; readonly limit: number; readonly previous?: number }
  | { readonly status: "ready"; readonly attempt: number; readonly limit: number }
  | { readonly status: "failed"; readonly attempt: number; readonly limit?: number }
  | { readonly status: "disposed" }

export type ForkHistoryEvent =
  | { readonly type: "load.requested"; readonly limit: number }
  | { readonly type: "load.succeeded"; readonly attempt: number }
  | { readonly type: "load.failed"; readonly attempt: number }
  | { readonly type: "load.timed-out"; readonly attempt: number }
  | { readonly type: "disposed" }

export const initialForkHistory: ForkHistoryState = { status: "loading", attempt: 1, limit: FORK_HISTORY_PAGE_SIZE }

export function transitionForkHistory(state: ForkHistoryState, event: ForkHistoryEvent): ForkHistoryState {
  if (state.status === "disposed") return state

  if (event.type === "disposed") return { status: "disposed" }

  if (event.type === "load.requested") {
    if (state.status === "loading") return state

    return { status: "loading", attempt: state.attempt + 1, limit: event.limit, previous: state.limit }
  }

  if (state.status !== "loading" || event.attempt !== state.attempt) return state

  if (event.type === "load.succeeded") return { status: "ready", attempt: state.attempt, limit: state.limit }

  return { status: "failed", attempt: state.attempt, limit: state.previous }
}

export function forkHistoryView(state: ForkHistoryState) {
  if (state.status === "disposed") return { limit: undefined, loading: false, failed: false }

  if (state.status === "loading") return { limit: state.previous, loading: true, failed: false }

  return { limit: state.limit, loading: false, failed: state.status === "failed" }
}
