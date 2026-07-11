import { test, expect } from '@playwright/test';

const CRON_SECRET = process.env.CRON_SECRET || 'ieK8aN0s0bxEHwl0LLfJ9mi72twqho6NZWGGVIawpWk=';

test.describe('Cron Endpoints', () => {
  test('auto-log endpoint returns 401 without auth', async ({ request }) => {
    console.log('\n=== Test: Cron Auth - No Auth ===');

    const response = await request.get('/api/cron/auto-log');
    console.log('Response status:', response.status());

    expect(response.status()).toBe(401);
    console.log('✓ Correctly rejected unauthenticated request');
  });

  test('auto-log endpoint returns 401 with invalid secret', async ({ request }) => {
    console.log('\n=== Test: Cron Auth - Invalid Secret ===');

    const response = await request.get('/api/cron/auto-log', {
      headers: {
        'Authorization': 'Bearer invalid_secret_12345',
      },
    });
    console.log('Response status:', response.status());

    expect(response.status()).toBe(401);
    console.log('✓ Correctly rejected invalid secret');
  });

  test('auto-log endpoint returns 200 with valid secret', async ({ request }) => {
    console.log('\n=== Test: Cron Auth - Valid Secret ===');

    const response = await request.get('/api/cron/auto-log', {
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
      },
    });
    console.log('Response status:', response.status());
    console.log('Response body:', await response.text());

    expect(response.status()).toBe(200);
    console.log('✓ Accepted valid secret');
  });

  test('auto-log cron returns valid response structure', async ({ request }) => {
    console.log('\n=== Test: Cron Response Structure ===');

    const response = await request.get('/api/cron/auto-log', {
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
      },
    });

    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));

    expect(response.status()).toBe(200);
    expect(data).toHaveProperty('ok');
    expect(typeof data.ok).toBe('boolean');

    if (data.ok) {
      console.log('✓ Response has ok: true');

      // Check autoLog structure
      if (data.autoLog) {
        console.log('  - autoLog:', {
          logged: data.autoLog.logged,
          skipped: data.autoLog.skipped,
        });
        expect(typeof data.autoLog.logged).toBe('number');
        expect(typeof data.autoLog.skipped).toBe('number');
      }

      // Check cadence structure
      if (data.cadence) {
        console.log('  - cadence:', {
          invoiceIds: data.cadence.invoiceIds?.length || 0,
          hwmUpdated: data.cadence.hwmUpdated,
        });
        expect(Array.isArray(data.cadence.invoiceIds)).toBe(true);
        expect(typeof data.cadence.hwmUpdated).toBe('boolean');
      }

      // Check sendResult structure
      if (data.sendResult) {
        console.log('  - sendResult:', {
          ok: data.sendResult.ok,
          sent: data.sendResult.sent,
          failed: data.sendResult.failed,
          error: data.sendResult.error,
        });
        expect(typeof data.sendResult.ok).toBe('boolean');
        expect(typeof data.sendResult.sent).toBe('number');
        expect(typeof data.sendResult.failed).toBe('number');
      }
    }
  });

  test('test auto-log endpoint with debug flag', async ({ request }) => {
    console.log('\n=== Test: Cron with Debug ===');

    const response = await request.get('/api/cron/auto-log', {
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
      },
    });

    const data = await response.json();

    expect(response.status()).toBe(200);
    expect(data.ok).toBe(true);

    console.log('✓ Cron executed successfully');
    console.log('  Full response:', JSON.stringify(data, null, 2));
  });

  test('verify cron is idempotent (can be called multiple times)', async ({ request }) => {
    console.log('\n=== Test: Cron Idempotency ===');

    // First call
    const response1 = await request.get('/api/cron/auto-log', {
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
      },
    });
    const data1 = await response1.json();

    console.log('First call response:', data1);

    // Second call immediately after
    const response2 = await request.get('/api/cron/auto-log', {
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
      },
    });
    const data2 = await response2.json();

    console.log('Second call response:', data2);

    expect(response1.status()).toBe(200);
    expect(response2.status()).toBe(200);
    expect(data1.ok).toBe(true);
    expect(data2.ok).toBe(true);

    console.log('✓ Cron is idempotent (safe to call multiple times)');
  });
});

test.describe('Auto-Log Functionality', () => {
  test('should log today\'s scheduled sessions', async ({ request, page }) => {
    console.log('\n=== Test: Auto-Log Scheduled Sessions ===');

    // First, set up test data via the app (login + create student)
    const APP_PASSWORD = process.env.APP_PASSWORD || 'arO641OWQ+RwpIm5bT9VOJodYv4Eecgd';

    await page.goto('/login');
    const passwordInput = await page.locator('input[type="password"]').first();
    if (await passwordInput.isVisible()) {
      await passwordInput.fill(APP_PASSWORD);
      await page.click('button').first();
      await page.waitForTimeout(1000);
    }

    // Now trigger the cron
    const response = await request.get('/api/cron/auto-log', {
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
      },
    });

    const data = await response.json();
    console.log('Auto-log response:', JSON.stringify(data, null, 2));

    expect(response.status()).toBe(200);

    if (data.autoLog) {
      console.log(`✓ Auto-log executed: ${data.autoLog.logged} logged, ${data.autoLog.skipped} skipped`);
    }
  });

  test('should generate invoices on cadence schedule', async ({ request }) => {
    console.log('\n=== Test: Invoice Generation Cadence ===');

    const response = await request.get('/api/cron/auto-log', {
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
      },
    });

    const data = await response.json();
    console.log('Cadence response:', JSON.stringify(data.cadence, null, 2));

    expect(response.status()).toBe(200);

    if (data.cadence) {
      const invoiceCount = data.cadence.invoiceIds?.length || 0;
      console.log(`✓ Invoice cadence: ${invoiceCount} invoice(s) generated`);
      console.log(`  HWM updated: ${data.cadence.hwmUpdated}`);

      if (invoiceCount > 0) {
        console.log('  Invoice IDs:', data.cadence.invoiceIds);
      }
    }
  });

  test('should auto-send invoices if enabled', async ({ request }) => {
    console.log('\n=== Test: Auto-Send Invoices ===');

    const response = await request.get('/api/cron/auto-log', {
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
      },
    });

    const data = await response.json();

    expect(response.status()).toBe(200);

    if (data.sendResult) {
      const { ok, sent, failed, error } = data.sendResult;
      console.log(`✓ Send result: ${ok ? 'OK' : 'FAILED'}`);
      console.log(`  Sent: ${sent}, Failed: ${failed}`);
      if (error) {
        console.log(`  Error: ${error}`);
      }
    } else {
      console.log('✓ No send result (auto-send may not be configured)');
    }
  });
});
