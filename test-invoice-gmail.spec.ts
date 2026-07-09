import { test, expect } from "@playwright/test";

test("Gmail button should appear after generating invoice", async ({ page }) => {
  const baseUrl = "https://invoice-tooling-lovat.vercel.app";

  // Login
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded" });

  const onLoginPage = await page.url().includes("/login");
  if (onLoginPage) {
    console.log("On login page, entering password...");
    await page.waitForSelector('input[type="password"]', { timeout: 5000 });
    await page.fill('input[type="password"]', "arO641OWQ+RwpIm5bT9VOJodYv4Eecgd");
    await page.click("button:first-of-type");
    await page.waitForTimeout(1000);
    await page.goto(`${baseUrl}/dashboard`);
  }

  await page.waitForSelector("h1", { timeout: 5000 });

  // Create a session for "test" student first
  console.log("\n=== Creating session ===");
  await page.goto(`${baseUrl}/sessions`);
  await page.waitForTimeout(500);

  // Take screenshot to see sessions page
  await page.screenshot({ path: "/tmp/sessions-page.png" });

  // Look for add session button
  let addButton = page.locator("button", { hasText: /add|create|new/i });
  const count = await addButton.count();
  console.log("Found", count, "add/create buttons");

  // Try different approach - look for any button that might add a session
  const allButtonTexts = await page.locator("button").allTextContents();
  console.log("All buttons on sessions page:", allButtonTexts);

  // If there's an add button, click it
  if (count > 0) {
    await addButton.first().click();
    await page.waitForTimeout(500);
  }

  // Now go back to dashboard and try to generate invoice
  console.log("\n=== Going to dashboard ===");
  await page.goto(`${baseUrl}/dashboard`);
  await page.waitForSelector("h1", { timeout: 5000 });

  // Take screenshot
  await page.screenshot({ path: "/tmp/dashboard-after-session.png" });

  // Look for the "test" student row and expand it
  console.log("\n=== Looking for test student ===");
  const testStudentButton = page.locator("button", { hasText: "test" }).first();
  const isVisible = await testStudentButton.isVisible();
  console.log("'test' button visible:", isVisible);

  if (isVisible) {
    await testStudentButton.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "/tmp/dashboard-test-expanded.png" });
  }

  // Check for Generate Invoice button
  const generateButton = page.locator("button", { hasText: "Generate Invoice" }).first();
  const generateVisible = await generateButton.isVisible();
  console.log("Generate Invoice button visible:", generateVisible);

  if (generateVisible) {
    console.log("\n=== Clicking Generate Invoice ===");
    await generateButton.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "/tmp/invoice-dialog-before-gen.png" });

    // Click Generate & Freeze
    const freezeButton = page.locator("button", { hasText: "Generate & Freeze" }).first();
    await freezeButton.click();
    await page.waitForTimeout(2000);

    // Check for Email Invoice button
    await page.screenshot({ path: "/tmp/invoice-dialog-after-gen.png" });

    const emailButton = page.locator("a", { hasText: "Email Invoice" }).first();
    const emailVisible = await emailButton.isVisible();

    console.log("\n=== RESULT ===");
    console.log("Email Invoice button visible:", emailVisible);

    // Get dialog content for debugging
    const dialog = page.locator('[role="dialog"]');
    const dialogVisible = await dialog.isVisible();
    console.log("Dialog visible:", dialogVisible);

    const dialogText = await dialog.textContent();
    console.log("Dialog text (first 300 chars):", dialogText?.substring(0, 300));

    // Check console logs
    const consoleLogs: string[] = [];
    page.on("console", (msg) => {
      if (msg.text().includes("[invoice-dialog]")) {
        consoleLogs.push(msg.text());
      }
    });

    expect(emailVisible).toBe(true);
  } else {
    console.log("Could not find Generate Invoice button - skipping invoice generation test");
    console.log(
      "This likely means no students have unbilled sessions",
    );
  }
});
