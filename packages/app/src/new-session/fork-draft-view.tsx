import { createEffect, createMemo, createSignal, Match, on, onCleanup, Show, Switch } from "solid-js"
import { SessionTimeline } from "@opencode/session-ui/timeline"
import type { SessionDocument } from "@opencode/session-ui/document"
import { Button } from "@opencode/ui/button"
import { Loader } from "@opencode/ui/loader"
import { Composer } from "@/composer/composer"
import { readPromptPresentation, parseCommentNote } from "@/composer/comment-note"
import { ComposerDropzone } from "@/composer/dropzone"
import type { ComposerModel } from "@/composer/model"
import { useLanguage } from "@/runtime/i18n/language"
import { useData } from "@/runtime/server/current"
import { SessionPanelFrame } from "@/session/session-frame"
import { useSettings } from "@/settings/model"
import { showToast } from "@/shell/notifications/toast"
import type { DraftTab } from "@/shell/tabs/tabs"
import { forkHistory } from "./fork-history"
import {
  FORK_HISTORY_PAGE_SIZE,
  FORK_HISTORY_TIMEOUT_MS,
  forkHistoryView,
  initialForkHistory,
  transitionForkHistory,
  type ForkHistoryEvent,
} from "./fork-history-machine"

export function ForkDraftView(props: { fork: NonNullable<DraftTab["fork"]>; composer: ComposerModel }) {
  const language = useLanguage()
  const settings = useSettings()
  const message = useData().session.message
  const sessionID = props.fork.sessionID
  const before = props.fork.messageID
  const [machine, setMachine] = createSignal(initialForkHistory)
  const dispatch = (event: ForkHistoryEvent) => setMachine((state) => transitionForkHistory(state, event))
  const view = createMemo(() => forkHistoryView(machine()))
  const limit = createMemo(() => view().limit)

  const historyAt = (size: number) => forkHistory(message.list(sessionID), before, size, message.more(sessionID))

  const history = createMemo(() => {
    const size = limit()

    return size === undefined ? undefined : historyAt(size)
  })

  const pending = createMemo(() => {
    const state = machine()

    return state.status === "loading" ? state : undefined
  })

  createEffect(
    on(pending, (request) => {
      if (!request) return

      const controller = new AbortController()

      const timer = setTimeout(() => {
        controller.abort()
        dispatch({ type: "load.timed-out", attempt: request.attempt })
      }, FORK_HISTORY_TIMEOUT_MS)

      onCleanup(() => {
        clearTimeout(timer)
        controller.abort()
      })

      void Promise.try(async () => {
        // A non-empty cache can still contain only live events. Sync reuses a loaded first page.
        if (request.previous === undefined) await message.sync(sessionID)

        while (!controller.signal.aborted && historyAt(request.limit).needsPage) {
          await message.loadMore(sessionID, { signal: controller.signal })
        }
      }).then(
        () => dispatch({ type: "load.succeeded", attempt: request.attempt }),
        () => dispatch({ type: "load.failed", attempt: request.attempt }),
      )
    }),
  )

  onCleanup(() => dispatch({ type: "disposed" }))

  const document = createMemo<SessionDocument | undefined>(() => {
    const inherited = history()?.messages

    if (!inherited) return

    return { sessionID, messages: inherited, status: { type: "idle" }, diffs: [] }
  })

  const presentation = createMemo(() =>
    Object.fromEntries(
      (document()?.messages ?? []).flatMap((item) => {
        if (item.type !== "user") return []
        const value = readPromptPresentation(item.metadata)
        const parsed = value ? undefined : parseCommentNote(item.text)

        return [
          [
            item.id,
            {
              displayText: value?.displayText,
              comments: value?.comments ?? (parsed ? [parsed] : []),
              references: value?.attachments,
            },
          ],
        ] as const
      }),
    ),
  )

  const loadEarlier = () => {
    dispatch({
      type: "load.requested",
      limit: Math.max(limit() ?? 0, history()?.messages?.length ?? 0) + FORK_HISTORY_PAGE_SIZE,
    })
  }

  createEffect(() => {
    if (view().failed && limit() !== undefined) showToast({ title: language.t("common.requestFailed") })
  })

  let viewport: HTMLDivElement | undefined
  const visible = createMemo(() => !!document())

  createEffect(
    on(visible, (ready) => {
      if (!ready) return

      const frame = requestAnimationFrame(() => {
        if (viewport) viewport.scrollTop = viewport.scrollHeight
      })

      onCleanup(() => cancelAnimationFrame(frame))
    }),
  )

  return (
    <SessionPanelFrame raised>
      <ComposerDropzone
        active={props.composer.state.drag === "active"}
        input={props.composer.model.selection.current()?.capabilities.input}
      />
      <header class="shrink-0 border-b border-v2-border-border-muted px-4 py-3 md:px-6">
        <h1 class="truncate text-14-medium text-v2-text-text-base" dir="auto">
          {props.fork.title}
        </h1>
        <p class="text-13-regular text-v2-text-text-muted">{language.t("session.tab.forkDraft.preview")}</p>
      </header>
      <div ref={(el) => (viewport = el)} data-scrollable data-focus-scope class="min-h-0 flex-1 overflow-y-auto">
        <div class="mx-auto w-full min-w-0 px-4 py-5 md:max-w-session md:px-6">
          <Switch fallback={<Loader />}>
            <Match when={document()}>
              {(preview) => (
                <>
                  <Show when={history()?.more}>
                    <Button size="small" variant="ghost-muted" disabled={view().loading} onClick={loadEarlier}>
                      {language.t("common.loadMore")}
                    </Button>
                  </Show>
                  <Show
                    when={preview().messages.length > 0}
                    fallback={
                      <p class="text-13-regular text-v2-text-text-muted">
                        {language.t("session.tab.forkDraft.historyEmpty")}
                      </p>
                    }
                  >
                    <SessionTimeline
                      document={preview()}
                      presentation={presentation()}
                      timelineDetail={settings.general.timelineDetail()}
                    />
                  </Show>
                </>
              )}
            </Match>
            <Match when={!view().loading}>
              <p class="text-13-regular text-v2-text-text-muted">
                {language.t("session.tab.forkDraft.historyUnavailable")}
              </p>
              <Show when={view().failed}>
                <Button
                  size="small"
                  variant="ghost-muted"
                  onClick={() => dispatch({ type: "load.requested", limit: FORK_HISTORY_PAGE_SIZE })}
                >
                  {language.t("common.retry")}
                </Button>
              </Show>
            </Match>
          </Switch>
        </div>
      </div>
      <div class="mx-auto w-full shrink-0 px-4 pb-3 pt-2 md:max-w-session md:px-6">
        <Composer model={props.composer} />
      </div>
    </SessionPanelFrame>
  )
}
