import type { SessionInfo } from "@opencode/client/promise"

export const MAX_FORK_INDENT = 2

/** Keep each fork immediately after its source's earlier branches, without indenting past the third level. */
export function forkTree<T>(items: readonly T[], key: (item: T) => string, source: (item: T) => string | undefined) {
  const keys = new Set(items.map(key))

  const children = Map.groupBy(items, (item) => {
    const parent = source(item)

    return parent && keys.has(parent) ? parent : undefined
  })

  const roots = children.get(undefined) ?? []
  const depths = new Map<string, number>()

  if (roots.length === items.length) return { tabs: roots, depths }

  const ordered: T[] = []

  // An explicit stack keeps all deeper forks reachable without increasing DOM depth.
  const pending = roots.toReversed().map((item) => ({ item, depth: 0 }))

  while (pending.length > 0) {
    const next = pending.pop()

    if (!next) break

    const id = key(next.item)
    ordered.push(next.item)

    if (next.depth > 0) depths.set(id, next.depth)

    const branches = children.get(id) ?? []

    for (let index = branches.length - 1; index >= 0; index--) {
      pending.push({ item: branches[index], depth: Math.min(next.depth + 1, MAX_FORK_INDENT) })
    }
  }

  return { tabs: ordered, depths }
}

type ForkSession = Pick<SessionInfo, "id" | "title"> & {
  fork?: Pick<NonNullable<SessionInfo["fork"]>, "sessionID">
  time: Pick<SessionInfo["time"], "created">
}

export function forkTitles(sessions: readonly ForkSession[], format: (title: string, branch: string) => string) {
  const siblings = Map.groupBy(sessions, (session) => session.fork?.sessionID)
  const branches = new Map<string, { source: string; position: string }>()

  for (const [source, children] of siblings) {
    if (!source) continue

    children
      .toSorted((a, b) => a.time.created - b.time.created || a.id.localeCompare(b.id))
      .forEach((child, index) => branches.set(child.id, { source, position: `#${index + 1}` }))
  }

  return new Map(
    sessions.flatMap((session) => {
      // The server's default title is depth-based. Only replace that suffix; a renamed branch still counts as a sibling.
      const title = session.title?.match(/^(.+) \(fork #\d+\)$/)?.[1]

      if (!title || !session.fork) return []

      const path: string[] = []

      for (let branch = branches.get(session.id); branch; branch = branches.get(branch.source)) {
        path.push(branch.position)
      }

      return [[session.id, format(title, path.reverse().join(""))] as const]
    }),
  )
}
