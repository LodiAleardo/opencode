import type { SessionInfo } from "@opencode/client/promise"
import { createMemo, createResource } from "solid-js"
import { useDialog } from "@opencode/ui/context/dialog"
import { Menu } from "@opencode/ui/menu"
import { useLanguage } from "@/runtime/i18n/language"
import type { ServerConnection } from "@/runtime/server/registry"
import { useGlobal, type ServerCtx } from "@/runtime/server/runtime"
import { ForkDialog, forkableMessages } from "@/session/commands/fork-dialog"
import { sessionLabel } from "@/session/title"
import { showToast } from "@/shell/notifications/toast"
import { useTabs } from "@/shell/tabs/tabs"

export function createSideTabFork() {
  const global = useGlobal()
  const tabs = useTabs()
  const dialog = useDialog()

  return {
    available: (server: ServerConnection.Key) => global.serverCtx(server)?.sdk.connection.status() === "connected",
    run(server: ServerConnection.Key, session: SessionInfo) {
      const ctx = global.serverCtx(server)

      if (!ctx) return

      dialog.show(() => (
        <ForkDraftPicker
          data={ctx.data}
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

function ForkDraftPicker(props: { data: ServerCtx["data"]; sessionID: string; onSelect: (messageID: string) => void }) {
  const language = useLanguage()
  const messages = createMemo(() => forkableMessages(props.data.session.message.list(props.sessionID)))

  const [load] = createResource(async () => {
    // A refresh would replace any older pages already loaded in the source chat.
    if (props.data.session.message.list(props.sessionID).length > 0) return

    await props.data.session.message.sync(props.sessionID).catch(() => {
      showToast({ title: language.t("common.requestFailed") })
    })
  })

  return <ForkDialog messages={messages()} loading={load.loading} onSelect={props.onSelect} />
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
