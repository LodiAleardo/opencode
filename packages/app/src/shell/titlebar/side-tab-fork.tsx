import type { SessionInfo } from "@opencode/client/promise"
import { createEffect, createMemo, createSignal, on, onCleanup } from "solid-js"
import { useDialog } from "@opencode/ui/context/dialog"
import { Menu } from "@opencode/ui/menu"
import { useLanguage } from "@/runtime/i18n/language"
import { supportsDraftForks } from "@/runtime/server/health-machine"
import type { ServerConnection } from "@/runtime/server/registry"
import { useGlobal, type ServerCtx } from "@/runtime/server/runtime"
import { ForkDialog, forkableMessages } from "@/session/commands/fork-dialog"
import { readUserMessageHistory } from "@/session/commands/user-message-history"
import { sessionLabel } from "@/session/title"
import { useTabs } from "@/shell/tabs/tabs"
import { forkPickerView, initialForkPicker, transitionForkPicker, type ForkPickerEvent } from "./fork-picker-machine"

export function createSideTabFork() {
  const global = useGlobal()
  const tabs = useTabs()
  const dialog = useDialog()

  const available = (server: ServerConnection.Key) =>
    supportsDraftForks(global.servers.health[server]) && global.serverCtx(server)?.sdk.connection.status() === "connected"

  return {
    available,
    run(server: ServerConnection.Key, session: SessionInfo) {
      const ctx = global.serverCtx(server)

      if (!ctx || !available(server)) return

      dialog.show(() => (
        <ForkDraftPicker
          ctx={ctx}
          sessionID={session.id}
          onSelect={(messageID) => {
            dialog.close()
            tabs.addSessionTab({ server, sessionId: session.id })
            void tabs.newDraft({
              server,
              directory: session.location.directory,
              fork: { sessionID: session.id, messageID, title: sessionLabel(session) },
            })
          }}
        />
      ))
    },
  }
}

function ForkDraftPicker(props: { ctx: ServerCtx; sessionID: string; onSelect: (messageID: string) => void }) {
  const dialog = useDialog()
  const [state, setState] = createSignal(initialForkPicker)
  const dispatch = (event: ForkPickerEvent) => setState((current) => transitionForkPicker(current, event))
  const view = createMemo(() => forkPickerView(state()))

  const messages = createMemo(() => {
    const cached = props.ctx.data.session.message.list(props.sessionID)
    const history = new Map(view().history.toReversed().map((message) => [message.id, message]))

    for (const message of cached) {
      if (message.type === "user" && !props.ctx.data.session.input.has(props.sessionID, message.id))
        history.set(message.id, message)
    }

    return forkableMessages([...history.values()].toSorted((a, b) => a.time.created - b.time.created))
  })

  createEffect(
    on(state, (request) => {
      if (request.status !== "loading") return

      const controller = new AbortController()
      onCleanup(() => controller.abort())
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)])

      void readUserMessageHistory(props.ctx.sdk.api.message, props.sessionID, signal).then(
        (history) => dispatch({ type: "loaded", attempt: request.attempt, history }),
        () => dispatch({ type: "failed", attempt: request.attempt }),
      )
    }),
  )

  createEffect(() => {
    if (dialog.closing) dispatch({ type: "disposed" })
  })
  onCleanup(() => dispatch({ type: "disposed" }))

  return (
    <ForkDialog
      messages={messages()}
      loading={view().loading}
      retryHistory={view().failed ? () => dispatch({ type: "retry" }) : undefined}
      onSelect={props.onSelect}
    />
  )
}

export function SideTabForkItem(props: {
  action: ReturnType<typeof createSideTabFork>
  server: ServerConnection.Key
  session: SessionInfo
}) {
  const language = useLanguage()

  return (
    <Menu.Item
      disabled={!props.action.available(props.server)}
      onSelect={() => props.action.run(props.server, props.session)}
    >
      {language.t("session.tab.fork")}
    </Menu.Item>
  )
}
