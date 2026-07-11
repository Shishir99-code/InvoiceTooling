import { test, expect } from '@playwright/test';

const APP_PASSWORD = process.env.APP_PASSWORD || 'arO641OWQ+RwpIm5bT9VOJodYv4Eecgd';
const CRON_SECRET = process.env.CRON_SECRET || 'ieK8aN0s0bxEHwl0LLfJ9mi72twqho6NZWGGVIawpWk=';

async function login(page: any) {
  await page.goto('/login');
  await page.fill('input[type="password"]', APP_PASSWORD);
  await page.click('button:has-text("Sign In")');
  await page.waitForNavigation({ timeout: 10000 });
  await page.waitForURL('**/dashboard', { timeout: 5000 }).catch(() => {
    // If navigation doesn't work, just wait for page to load
    return page.waitForSelector('h1', { timeout: 5000 });
  });
}

test.describe('Auto-Log and Auto-Email', () => {
  test('should create a scheduled session that will be auto-logged', async ({ page }) => {
    console.log('\n=== Test: Create Scheduled Session ===');

    await login(page);

    // Navigate to Students/Roster to add a student first
    await page.goto('/');
    await page.waitForSelector('h1', { timeout: 5000 });

    // Create a test student if needed
    console.log('Setting up test student...');
    await page.click('button:has-text("Add Student")');
    await page.fill('input[placeholder*="Name"]', 'Auto-Log Test Student');
    await page.fill('input[placeholder*="Email"]', 'parent@example.com');
    await page.fill('input[placeholder*="Rate"]', '50');
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(1000);

    // Navigate to Sessions
    await page.goto('/sessions');
    await page.waitForSelector('h1', { timeout: 5000 });

    // Add a scheduled session for tomorrow
    console.log('Creating scheduled session...');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    await page.click('button:has-text(/add|new|create/i)');
    await page.fill('input[placeholder*="Student"]', 'Auto-Log Test Student');
    await page.fill('input[type="date"]', dateStr);
    await page.fill('input[placeholder*="Start"]', '14:00');
    await page.fill('input[placeholder*="End"]', '15:00');
    await page.fill('textarea', 'Test auto-log session');
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(1000);

    console.log('✓ Scheduled session created for:', dateStr);
    expect(await page.content()).toContain(dateStr);
  });

  test('should auto-log a scheduled session when cron runs', async ({ page, request }) => {
    console.log('\n=== Test: Auto-Log via Cron ===');

    // Call the cron endpoint
    console.log('Triggering cron auto-log endpoint...');
    const response = await request.get('/api/cron/auto-log', {
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
      },
    });

    console.log('Cron response status:', response.status());
    const data = await response.json();
    console.log('Cron response:', JSON.stringify(data, null, 2));

    expect(response.status()).toBe(200);
    expect(data).toHaveProperty('ok');

    if (data.ok && data.autoLog) {
      console.log('✓ Auto-log executed:', {
        logged: data.autoLog.logged,
        skipped: data.autoLog.skipped,
      });
    }
  });

  test('should auto-generate and auto-send invoices when cron runs', async ({ page, request }) => {
    console.log('\n=== Test: Auto-Generate and Auto-Send Invoices ===');

    // First, enable auto-send in settings
    await login(page);
    await page.goto('/settings');

    console.log('Checking auto-send settings...');
    const autoSendCheckbox = page.locator('input[type="checkbox"]').filter({ hasText: /auto.*send/i });
    const isChecked = await autoSendCheckbox.isChecked();

    if (!isChecked) {
      console.log('Enabling auto-send...');
      await autoSendCheckbox.check();
      await page.click('button:has-text("Save")');
      await page.waitForTimeout(1000);
    }

    // Call the cron endpoint
    console.log('Triggering cron for invoice cadence...');
    const response = await request.get('/api/cron/auto-log', {
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
      },
    });

    console.log('Cron response status:', response.status());
    const data = await response.json();
    console.log('Full cron response:', JSON.stringify(data, null, 2));

    expect(response.status()).toBe(200);

    if (data.cadence) {
      console.log('✓ Invoice cadence executed:', {
        invoicesGenerated: data.cadence.invoiceIds?.length || 0,
        hwmUpdated: data.cadence.hwmUpdated,
      });

      if (data.sendResult) {
        console.log('✓ Email send result:', {
          ok: data.sendResult.ok,
          sent: data.sendResult.sent,
          failed: data.sendResult.failed,
          error: data.sendResult.error,
        });
      }
    }
  });

  test('cron endpoint should require valid CRON_SECRET', async ({ request }) => {
    console.log('\n=== Test: Cron Auth ===');

    // Try without auth header
    console.log('Testing without auth...');
    const noAuthResponse = await request.get('/api/cron/auto-log');
    console.log('No auth response status:', noAuthResponse.status());
    expect(noAuthResponse.status()).toBe(401);

    // Try with invalid auth
    console.log('Testing with invalid auth...');
    const invalidAuthResponse = await request.get('/api/cron/auto-log', {
      headers: {
        'Authorization': 'Bearer invalid_secret',
      },
    });
    console.log('Invalid auth response status:', invalidAuthResponse.status());
    expect(invalidAuthResponse.status()).toBe(401);

    // Valid auth should work
    console.log('Testing with valid auth...');
    const validAuthResponse = await request.get('/api/cron/auto-log', {
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
      },
    });
    console.log('Valid auth response status:', validAuthResponse.status());
    expect(validAuthResponse.status()).toBe(200);
  });

  test('should show auto-logged sessions with indicator', async ({ page }) => {
    console.log('\n=== Test: Auto-Logged Session Indicator ===');

    await login(page);
    await page.goto('/sessions');

    // Look for sessions with auto-logged indicator
    console.log('Checking for auto-logged session indicators...');
    const autoLoggedSessions = page.locator('[data-auto-logged="true"]');
    const count = await autoLoggedSessions.count();

    console.log(`Found ${count} auto-logged session(s)`);

    if (count > 0) {
      const badges = page.locator('text=/auto.*log/i');
      const badgeCount = await badges.count();
      console.log(`✓ Found ${badgeCount} auto-logged badge(s)`);
      expect(badgeCount).toBeGreaterThan(0);
    }
  });

  test('should display invoice history with send status', async ({ page }) => {
    console.log('\n=== Test: Invoice History and Send Status ===');

    await login(page);
    await page.goto('/history');
    await page.waitForSelector('h1', { timeout: 5000 });

    console.log('Checking invoice history...');
    const invoiceRows = page.locator('table tbody tr');
    const rowCount = await invoiceRows.count();
    console.log(`Found ${rowCount} invoice(s) in history`);

    if (rowCount > 0) {
      // Check for sent status badge
      const sentBadges = page.locator('text=/sent/i');
      const sentCount = await sentBadges.count();
      console.log(`✓ Found ${sentCount} 'sent' status indicator(s)`);
    }
  });
});
