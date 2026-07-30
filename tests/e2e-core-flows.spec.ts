import { expect, test, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Full-journey E2E for the post-cron app: everything is synchronous and
// user-driven, so the whole flow is testable in one pass — login → student →
// weekly slot → calendar confirm-to-log → session → invoice → history.
// Every list/table in this app dual-renders a desktop <table> and a
// "md:hidden" mobile card stack simultaneously (CSS-only toggle, both stay in
// the DOM) — locators here scope to the desktop <tr> to stay strict-mode safe
// at the default >=md viewport. Email sending is NOT exercised (it would send
// real mail via Gmail).

const APP_PASSWORD = readFileSync(join(__dirname, "..", ".env.local"), "utf8")
  .match(/^APP_PASSWORD=(.+)$/m)![1]
  .replace(/^"|"$/g, "");

const STUDENT = "E2E Test Student";

// Local calendar date + weekday label (dev server and test share a machine).
const now = new Date();
const WEEKDAY_LABEL = now.toLocaleDateString("en-US", { weekday: "long" });

const DATABASE_URL = readFileSync(join(__dirname, "..", ".env.local"), "utf8")
  .match(/^DATABASE_URL=(.+)$/m)![1]
  .replace(/^"|"$/g, "");

// Idempotency guard: a prior interrupted run can leave an "E2E Test Student"
// row behind, which would duplicate-match every locator below. All the FKs
// here are onDelete "restrict" (schema.ts) — never cascade — so children
// must be cleared before the student row itself.
test.beforeAll(async () => {
  const sql = neon(DATABASE_URL);
  const rows = await sql`SELECT id FROM students WHERE name = ${STUDENT}`;
  for (const { id } of rows) {
    await sql`DELETE FROM sessions WHERE student_id = ${id}`;
    await sql`DELETE FROM schedule_slots WHERE student_id = ${id}`;
    await sql`DELETE FROM invoices WHERE student_id = ${id}`;
    await sql`DELETE FROM students WHERE id = ${id}`;
  }
});

async function login(page: Page) {
  await page.goto("/login");
  await page.fill('input[name="password"]', APP_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

test.describe.serial("core flows", () => {
  test("password gate blocks and admits", async ({ page }) => {
    await page.goto("/sessions");
    await expect(page).toHaveURL(/\/login/);

    await page.fill('input[name="password"]', "definitely-wrong-password");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/login/);

    await login(page);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("create student", async ({ page }) => {
    await login(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Add Student" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator('input[name="name"]').fill(STUDENT);
    await dialog.locator('input[name="rateDollars"]').fill("60");
    await dialog.locator('input[name="parentEmail"]').fill("e2e-parent@example.com");
    await dialog.getByRole("button", { name: "Add Student" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator("tr").filter({ hasText: STUDENT })).toBeVisible();
  });

  test("add weekly schedule slot", async ({ page }) => {
    await login(page);
    await page.goto("/");
    const row = page.locator("tr").filter({ hasText: STUDENT });
    await row.getByRole("button", { name: "Schedule" }).click();

    const scheduleDialog = page
      .getByRole("dialog")
      .filter({ hasText: "Weekly schedule" });
    await scheduleDialog.getByRole("button", { name: "Add slot" }).click();

    const slotDialog = page
      .getByRole("dialog")
      .filter({ hasText: "Start time" });
    const combos = slotDialog.getByRole("combobox");
    await combos.nth(0).click();
    await page.getByRole("option", { name: WEEKDAY_LABEL }).click();
    await slotDialog.locator('input[name="startTime"]').fill("15:00");
    await combos.nth(1).click();
    await page.getByRole("option", { name: "1 hr", exact: true }).click();
    await slotDialog.getByRole("button", { name: "Add slot" }).click();

    await expect(
      scheduleDialog.getByText(`${WEEKDAY_LABEL}s, 3:00–4:00 PM`),
    ).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("calendar shows pending occurrence and confirms it into a session", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/calendar");

    // The slot was created today with today's weekday → amber pending chip.
    const pendingChip = page
      .locator("button.border-dashed")
      .filter({ hasText: "E2E" });
    await expect(pendingChip).toBeVisible();

    await pendingChip.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(STUDENT)).toBeVisible();
    await expect(dialog.getByText("$60.00")).toBeVisible(); // 1 hr @ $60
    await dialog.locator('textarea[name="notes"]').fill("Logged from calendar E2E");
    await dialog.getByRole("button", { name: "Log Session" }).click();
    await expect(dialog).toHaveCount(0);

    // Chip flips from pending to logged.
    await expect(page.getByText("✓ E2E")).toBeVisible();
    await expect(
      page.locator("button.border-dashed").filter({ hasText: "E2E" }),
    ).toHaveCount(0);
  });

  test("confirmed session appears on Sessions with correct amount", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/sessions");
    // Sessions are grouped per student behind a collapsed accordion; the
    // trigger button itself shows the group's unbilled total ($60 for our
    // single 1hr @ $60 session) before expanding.
    const groupTrigger = page.getByRole("button", { name: new RegExp(STUDENT) });
    await expect(groupTrigger).toBeVisible();
    await expect(groupTrigger.getByText("1 session")).toBeVisible();
    await expect(groupTrigger.getByText("$60.00")).toBeVisible();

    await groupTrigger.click();
    await expect(page.getByText("Logged from calendar E2E").first()).toBeVisible();
  });

  test("generate invoice from dashboard and see it in history", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/dashboard");

    // Dashboard rows are plain divs (collapsible cards), not table rows —
    // the Generate Invoice trigger sits in the always-visible header.
    const row = page.locator("div").filter({ hasText: STUDENT }).last();
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Generate Invoice" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(`Generate Invoice for ${STUDENT}`)).toBeVisible();
    await dialog.getByRole("button", { name: "Generate & Freeze" }).click();
    // Wait for the actual server-action round trip to resolve — "Done" only
    // renders on real success (isSuccess), unlike the freeze button
    // disappearing, which happens immediately on click (button swaps to
    // "Generating…" while pending) and would race ahead of the real result.
    await expect(dialog.getByRole("button", { name: "Done" })).toBeVisible({
      timeout: 10000,
    });
    await expect(dialog.getByText(/error/i)).toHaveCount(0);
    await page.keyboard.press("Escape");

    await page.goto("/history");
    const invoiceRow = page.locator("tr").filter({ hasText: STUDENT });
    await expect(invoiceRow.getByText("$60.00").first()).toBeVisible();
    await expect(invoiceRow.getByText("Not sent yet")).toBeVisible();
  });

  test("settings has no cron-era sections; email delivery remains", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/settings");
    await expect(page.getByText("Automatic Invoicing")).toHaveCount(0);
    await expect(page.getByText("Auto-send")).toHaveCount(0);
    await expect(page.getByText("Zelle Handle")).toBeVisible();
  });

  test("history bulk-send select-all surfaces Send Selected", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/history");
    const headerCheckbox = page.locator("thead").getByRole("checkbox");
    await expect(headerCheckbox).toBeVisible();
    await headerCheckbox.check();
    await expect(
      page.getByRole("button", { name: "Send Selected" }),
    ).toBeVisible();
    // Do NOT click Send — that would email real recipients via Gmail.
  });
});
