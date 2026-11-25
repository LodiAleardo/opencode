import type { SessionMessageUser } from "@opencode/client/promise"

type State =
  | { readonly status: "loading" | "failed"; readonly attempt: number }
  | { readonly status: "ready"; readonly history: readonly SessionMessageUser[] }
  | { readonly status: "closed" }

export type ForkPickerEvent =
  | { readonly type: "loaded"; readonly attempt: number; readonly history: readonly SessionMessageUser[] }
  | { readonly type: "failed"; readonly attempt: number }
  | { readonly type: "retry" }
  | { readonly type: "disposed" }

export const initialForkPicker: State = { status: "loading", attempt: 1 }

export function transitionForkPicker(state: State, event: ForkPickerEvent): State {
  if (state.status === "closed") return state

  if (event.type === "disposed") return { status: "closed" }

  if (event.type === "retry")
    return state.status === "failed" ? { status: "loading", attempt: state.attempt + 1 } : state

  if (state.status !== "loading" || state.attempt !== event.attempt) return state

  return event.type === "loaded"
    ? { status: "ready", history: event.history }
    : { status: "failed", attempt: event.attempt }
}

export function forkPickerView(state: State) {
  return {
    history: state.status === "ready" ? state.history : [],
    loading: state.status === "loading",
    failed: state.status === "failed",
  }
}
