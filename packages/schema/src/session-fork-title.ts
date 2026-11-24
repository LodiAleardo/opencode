import { Schema } from "effect"
import { SessionID } from "./session-id.js"
import { SessionMessage } from "./session-message.js"

export const key = "$opencode_fork_title"

export const Request = Schema.Struct({
  sessionID: SessionID,
  messageID: SessionMessage.ID,
  fallback: Schema.String,
})

export * as SessionForkTitle from "./session-fork-title.js"
