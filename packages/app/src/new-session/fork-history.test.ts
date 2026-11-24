import { expect, test } from "bun:test"
import type {
  SessionMessageAssistant,
  SessionMessageCompactionCompleted,
  SessionMessageCompactionRunning,
  SessionMessageShell,
  SessionMessageUser,
} from "@opencode/client/promise"
import { forkHistory } from "./fork-history"

const user = (id: string): SessionMessageUser => ({ id, type: "user", text: id, time: { created: 0 } })

const assistant = (id: string, completed?: number): SessionMessageAssistant => ({
  id,
  type: "assistant",
  time: { created: 0, completed },
  agent: "build",
  model: { id: "model", providerID: "provider" },
  content: [],
})

test("previews settled history before the selected message", () => {
  const original = user("original")
  const reply = assistant("reply", 1)
  const selected = user("selected")

  const shell: SessionMessageShell = {
    id: "running shell",
    type: "shell",
    shellID: "shell",
    command: "pwd",
    status: "running",
    time: { created: 0 },
  }

  const exited: SessionMessageShell = {
    ...shell,
    id: "exited shell",
    status: "exited",
    time: { created: 0, completed: 1 },
  }

  const compaction: SessionMessageCompactionRunning = {
    id: "running compaction",
    type: "compaction",
    status: "running",
    reason: "manual",
    summary: "",
    time: { created: 0 },
  }

  const compacted: SessionMessageCompactionCompleted = { ...compaction, id: "compacted", status: "completed" }

  const messages = [
    original,
    reply,
    exited,
    compacted,
    assistant("still streaming"),
    shell,
    compaction,
    selected,
    assistant("later", 2),
  ]

  expect(forkHistory(messages, selected.id, 40, false).messages).toEqual([original, reply, exited, compacted])
  expect(forkHistory(messages, original.id, 40, false).messages).toEqual([])
  expect(forkHistory(messages, "unloaded", 40, false).messages).toBeUndefined()
})

test("keeps paging past a cached fork point and starts the preview at a prompt, not halfway through its reply", () => {
  const first = user("first")
  const second = user("second")
  const third = user("third")
  const selected = user("selected")
  const reply = assistant("reply", 1)
  const cached = [third, assistant("latest reply", 1), selected]

  expect(forkHistory(cached, selected.id, 4, true).needsPage).toBe(true)
  expect(forkHistory([reply, ...cached], selected.id, 3, true).needsPage).toBe(true)

  const loaded = [first, assistant("first reply", 1), second, reply, ...cached]
  expect(forkHistory(loaded, selected.id, 3, false)).toEqual({
    messages: [second, reply, ...cached.slice(0, -1)],
    more: true,
    needsPage: false,
  })
  expect(forkHistory(loaded, selected.id, 8, false)).toEqual({
    messages: loaded.slice(0, -1),
    more: false,
    needsPage: false,
  })
})
