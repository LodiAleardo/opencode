import { expect, story } from "../../stories/playwright/story"

story("a side tab's fork picker opens an unsent draft, not a session", async ({ mount, page }) => {
  const sidebar = await mount("app-desktop-project-sidebar--session-forks")
  const links = sidebar.locator('[data-titlebar-tab-link][href*="/session/"]')
  const source = links.filter({ hasText: "Sidebar focus order" })
  await expect(source).toBeVisible()
  await source.click({ button: "right" })
  await page.getByRole("menuitem", { name: "Fork", exact: true }).click()

  const picker = page.getByRole("dialog", { name: "Fork from message" })
  await picker.getByRole("option", { name: /Prototype focus restoration/ }).click()

  const draft = sidebar.getByRole("link", { name: "Fork draft", exact: true })
  await expect(draft).toHaveAttribute("aria-current", "page")
  await expect(links.locator("[data-titlebar-tab-title]")).toHaveText([
    "Restore workspace tabs",
    "Review the keyboard navigation guide for switching between project sessions",
    "Sidebar focus order",
    "Landing page spacing",
  ])

  await source.click()
  await expect(source).toHaveAttribute("aria-current", "page")
  await expect(draft).not.toHaveAttribute("aria-current")
  await expect(sidebar.getByLabel("Fork requests")).toHaveText("Fork requests: 0")
})

story("a server without draft-fork support cannot start a side-tab fork", async ({ mount, page }) => {
  const sidebar = await mount("app-desktop-project-sidebar--session-forks", { args: { draftForks: false } })
  const source = sidebar.locator('[data-titlebar-tab-link][href*="/session/"]').filter({ hasText: "Sidebar focus order" })

  await source.click({ button: "right" })
  await expect(page.getByRole("menuitem", { name: "Fork", exact: true })).toBeDisabled()
})
