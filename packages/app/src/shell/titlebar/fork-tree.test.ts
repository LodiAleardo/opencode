import { expect, test } from "bun:test"
import { forkTitles, forkTree } from "./fork-tree"

test("orders fork families by source, caps indentation, and keeps forks with an absent source", () => {
  const items = [
    { id: "branch", source: "original" },
    { id: "unrelated" },
    { id: "deepest", source: "nested" },
    { id: "original" },
    { id: "sibling", source: "original" },
    { id: "nested", source: "branch" },
    { id: "orphan", source: "closed" },
  ]

  const tree = forkTree(
    items,
    (item) => item.id,
    (item) => item.source,
  )

  expect(tree.tabs.map((item) => [item.id, tree.depths.get(item.id) ?? 0])).toEqual([
    ["unrelated", 0],
    ["original", 0],
    ["branch", 1],
    ["nested", 2],
    ["deepest", 2],
    ["sibling", 1],
    ["orphan", 0],
  ])
})

test("numbers sibling forks by creation and gives nested forks their parent's branch number", () => {
  const sessions = [
    { id: "root", title: "Greeting", time: { created: 0 } },
    { id: "later", title: "Greeting (fork #1)", fork: { sessionID: "root" }, time: { created: 2 } },
    { id: "first", title: "Greeting (fork #1)", fork: { sessionID: "root" }, time: { created: 1 } },
    { id: "nested2", title: "Greeting (fork #2)", fork: { sessionID: "later" }, time: { created: 3 } },
    { id: "nested1", title: "Greeting (fork #2)", fork: { sessionID: "later" }, time: { created: 3 } },
  ]

  const titles = forkTitles(sessions, (title, branch) => `${title} (fork ${branch})`)

  expect(titles).toEqual(
    new Map([
      ["first", "Greeting (fork #1)"],
      ["later", "Greeting (fork #2)"],
      ["nested1", "Greeting (fork #2#1)"],
      ["nested2", "Greeting (fork #2#2)"],
    ]),
  )
})

test("keeps custom fork names and still counts them when numbering their siblings", () => {
  const titles = forkTitles(
    [
      { id: "renamed", title: "Try with OAuth", fork: { sessionID: "root" }, time: { created: 1 } },
      { id: "next", title: "Greeting (fork #1)", fork: { sessionID: "root" }, time: { created: 2 } },
    ],
    (title, branch) => `${title} (fork ${branch})`,
  )

  expect(titles).toEqual(new Map([["next", "Greeting (fork #2)"]]))
})
