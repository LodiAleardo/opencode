import { createEffect, on, type Accessor } from "solid-js"
import { useNavigate, useParams } from "@solidjs/router"
import { base64Encode } from "@opencode/util/encode"
import { useComposerState } from "@/composer/persistence"
import { extractPromptContext, extractPromptFromMessage } from "@/composer/prompt"
import { useLanguage } from "@/runtime/i18n/language"
import { useServerSDK } from "@/runtime/server/client"
import { useData, useServer } from "@/runtime/server/current"
import { sessionHref } from "@/shell/routes/session"
import { useWorkspaceLocation } from "@/workspaces/location"
import { createForkAction } from "./fork-action"

export type SessionForkControllerOptions =
  | { readonly surface: "inline" }
  | { readonly surface: "dialog"; readonly closing: Accessor<boolean>; readonly onClose: () => void }

/**
 * Forks a session before one of its prompts: the new session keeps the history above the prompt, opens, and has the
 * prompt back in its composer to edit and send. One fork runs at a time; `fork` resolves to whether it opened.
 */
export function createSessionForkController(options: SessionForkControllerOptions) {
  const navigate = useNavigate()
  const params = useParams()
  const data = useData()
  const serverSDK = useServerSDK()
  const location = useWorkspaceLocation()
  const prompt = useComposerState()
  const language = useLanguage()
  const server = useServer()
  const action = createForkAction(options.surface, options.surface === "dialog" ? options.onClose : undefined)

  const fork = (input: { sessionID: string; messageID: string }) => {
    const message = data.session.message.get(input.sessionID, input.messageID)

    if (message?.type !== "user") return Promise.resolve(false)

    // The prompt's paths are relative to the session it was sent in.
    const directory = data.session.get(input.sessionID)?.location.directory ?? location().directory
    const context = extractPromptContext(message, { directory })

    return action
      .fork(
        {
          type: "fork.requested",
          sessionID: input.sessionID,
          messageID: input.messageID,
          draft: {
            prompt: extractPromptFromMessage(message, {
              directory,
              attachmentName: language.t("common.attachment"),
              sessionTitle: (id) => data.session.get(id)?.title,
            }),
            context: [...context.comments, ...context.files],
          },
        },
        (sessionID, before, signal) => serverSDK.api.session.fork({ sessionID, before }, { signal }),
        (session, draft) => {
          data.session.remember(session)

          if (draft) {
            const target = prompt.capture({ dir: base64Encode(session.location.directory), id: session.id })
            target.set(draft.prompt)
            target.context.replace([...draft.context])
          }

          navigate(sessionHref(server.key, session.id))
        },
      )
      .then(Boolean)
  }

  createEffect(
    on(
      () => params.id,
      () => action.dispatch({ type: "session.changed" }),
      { defer: true },
    ),
  )

  if (options.surface === "dialog") {
    createEffect(() => {
      if (options.closing()) action.dispatch({ type: "disposed" })
    })
  }

  return {
    fork,
    view: action.view,
  }
}

/** The timeline's "Fork from here", resolving to whether the fork opened. */
export function useSessionFork() {
  const controller = createSessionForkController({ surface: "inline" })

  return (input: { sessionID: string; messageID: string }) => controller.fork(input)
}
