import type { OpenCodeClient, SessionMessageUser } from "@opencode/client/promise"

/** Read prompt history without publishing pages into the source timeline. */
export async function readUserMessageHistory(
  message: OpenCodeClient["message"],
  sessionID: string,
  signal: AbortSignal,
) {
  const history: SessionMessageUser[] = []
  let cursor: string | undefined

  do {
    const page = await message.list(
      { sessionID, type: "user", order: "desc", limit: 200, cursor },
      { signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]) },
    )

    signal.throwIfAborted()

    for (const item of page.data) {
      if (item.type === "user") history.push(item)
    }

    cursor = page.cursor.next ?? undefined
  } while (cursor)

  return history
}
