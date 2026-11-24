import type { SessionMessageInfo } from "@opencode/client/promise"

export function forkHistory(messages: readonly SessionMessageInfo[], before: string, limit: number, more: boolean) {
  const index = messages.findIndex((message) => message.id === before)

  if (index === -1) return { messages: undefined, more, needsPage: more }

  // Match the fork projector: running work stays on the source session.
  const inherited = messages.slice(0, index).filter((message) => {
    switch (message.type) {
      case "assistant":
        return message.time.completed !== undefined
      case "shell":
      case "compaction":
        return message.status !== "running"
      default:
        return true
    }
  })

  // A message page can start in the middle of a reply. Keep its prompt with it.
  const cutoff = Math.max(0, inherited.length - limit)
  const turnStart = inherited.findLastIndex((item, i) => i <= cutoff && item.type === "user")

  return {
    messages: inherited.slice(Math.max(0, turnStart)),
    more: more || turnStart > 0,
    needsPage: more && (inherited.length < limit || turnStart === -1),
  }
}
