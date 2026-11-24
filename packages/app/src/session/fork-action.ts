import { createSignal, onCleanup } from "solid-js"
import type { SessionInfo } from "@opencode/client/promise"
import { useLanguage } from "@/runtime/i18n/language"
import { showToast } from "@/shell/notifications/toast"
import {
  createSessionForkState,
  selectSessionForkView,
  transitionSessionFork,
  type SessionForkDraft,
  type SessionForkEffect,
  type SessionForkEvent,
  type SessionForkSurface,
} from "./fork-machine"

type Request = Extract<SessionForkEvent, { type: "fork.requested" }>

export function createForkAction(surface: SessionForkSurface, onClose?: () => void) {
  const language = useLanguage()

  const [machine, setMachine] = createSignal(createSessionForkState(surface))

  const runs = new Map<
    number,
    {
      controller: AbortController
      timer: ReturnType<typeof setTimeout>
      done: PromiseWithResolvers<SessionInfo | undefined>
      open?: (session: SessionInfo, draft?: SessionForkDraft) => void
    }
  >()

  const settle = (attempt: number, session?: SessionInfo) => {
    const entry = runs.get(attempt)

    if (!entry) return
    runs.delete(attempt)
    clearTimeout(entry.timer)
    entry.done.resolve(session)

    return entry
  }

  const run = (effect: SessionForkEffect) => {
    if (effect.type === "fork.start") return

    if (effect.type === "fork.cancel") return settle(effect.attempt)?.controller.abort()

    if (effect.type === "fork.open") return settle(effect.attempt, effect.session)?.open?.(effect.session, effect.draft)

    if (effect.type === "dialog.close") return onClose?.()

    settle(effect.attempt)
    showToast({ title: language.t("common.requestFailed"), description: effect.message })
  }

  const dispatch = (event: SessionForkEvent) => {
    const previous = machine()
    const next = transitionSessionFork(previous, event)

    if (next.state !== previous) setMachine(next.state)
    next.effects.forEach(run)

    return next.effects
  }

  const fork = (
    request: Request,
    perform: (sessionID: string, before: string, signal: AbortSignal) => Promise<SessionInfo>,
    open?: (session: SessionInfo, draft?: SessionForkDraft) => void,
  ) => {
    const start = dispatch(request).find((effect) => effect.type === "fork.start")

    if (!start) return Promise.resolve(undefined)

    const controller = new AbortController()
    const done = Promise.withResolvers<SessionInfo | undefined>()
    runs.set(start.attempt, {
      controller,
      timer: setTimeout(() => dispatch({ type: "fork.timed-out", attempt: start.attempt }), start.timeoutMs),
      done,
      open,
    })
    void Promise.try(() => perform(start.sessionID, start.messageID, controller.signal)).then(
      (session) => dispatch({ type: "fork.succeeded", attempt: start.attempt, session }),
      (cause: unknown) =>
        dispatch({
          type: "fork.failed",
          attempt: start.attempt,
          message: cause instanceof Error ? cause.message : String(cause),
        }),
    )

    return done.promise
  }

  onCleanup(() => dispatch({ type: "disposed" }))

  return { fork, dispatch, view: () => selectSessionForkView(machine()) }
}
