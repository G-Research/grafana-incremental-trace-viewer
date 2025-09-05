import { test, expect } from '@grafana/plugin-e2e';
import { getLastTraceId } from './util';

const TIMEOUT = {
  SHORT: 5000,
  MEDIUM: 10000,
  LONG: 15000,
} as const;

const DASHBOARD_UID = 'gr-trace-viewer-dashboard' as const;
const INVALID_TRACE_ID = 'invalid-trace-id' as const;
const PANEL_HEADER_TESTID = 'data-testid Panel header Incremental Trace Viewer' as const;

test.describe('Span Overview Display', () => {
  test('should display root span with correct name on initial render', async ({ page, gotoDashboardPage }) => {
    const traceId = await getLastTraceId();
    
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({
        'var-traceId': traceId,
      }),
    });

    await expect(page.getByTestId(PANEL_HEADER_TESTID)).toBeVisible({ timeout: TIMEOUT.SHORT });

    const rootSpanNameElement = page.getByTestId('span-name-MissionControl');
    await expect(rootSpanNameElement).toBeVisible();
    await expect(rootSpanNameElement).toHaveText('MissionControl');
  });

  test('should display multiple spans when available', async ({ page, gotoDashboardPage }) => {
    const traceId = await getLastTraceId();
    
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({
        'var-traceId': traceId,
      }),
    });

    await expect(page.getByTestId(PANEL_HEADER_TESTID)).toBeVisible({ timeout: TIMEOUT.SHORT });

    const spanElements = page.locator('.span-row');
    await expect(spanElements.first()).toBeVisible();
    const spanCount = await spanElements.count();
    expect(spanCount).toBeGreaterThan(0);
  });

  test('should display span structure correctly', async ({ page, gotoDashboardPage }) => {
    const traceId = await getLastTraceId();
    
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({
        'var-traceId': traceId,
      }),
    });

    await expect(page.getByTestId(PANEL_HEADER_TESTID)).toBeVisible({ timeout: TIMEOUT.SHORT });

    // Check that span duration elements exist (they are the visual timeline bars)
    const spanDurationElements = page.locator('.span-duration');
    console.log('spanDurationElements', spanDurationElements);
    const durationCount = await spanDurationElements.count();
    expect(durationCount).toBeGreaterThan(0);
    
    // Verify the first span duration element is visible
    await expect(spanDurationElements.first()).toBeVisible();
    
    // Check that span names are visible
    const spanNames = page.locator('.span-row');
    const nameCount = await spanNames.count();
    expect(nameCount).toBeGreaterThan(0);
    await expect(spanNames.first()).toBeVisible();
  });
});

test.describe('Header Information', () => {
  test('should display trace id in header', async ({ page, gotoDashboardPage }) => {
    const traceId = await getLastTraceId();
    
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({
        'var-traceId': traceId,
      }),
    });

    const headerTraceId = page.getByTestId('header-trace-id');
    await expect(headerTraceId).toBeVisible();
    await expect(headerTraceId).toHaveText(traceId.slice(0, 8));
  });

  test('should display header duration', async ({ page, gotoDashboardPage }) => {
    const traceId = await getLastTraceId();
    
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({
        'var-traceId': traceId,
      }),
    });

    // Use first() to handle multiple elements with same test ID
    const headerDuration = page.getByTestId('header-duration').first();
    await expect(headerDuration).toBeVisible();
    const durationText = await headerDuration.textContent();
    expect(durationText).toBeTruthy();
    expect(durationText).toMatch(/\d+(\.\d+)?(ms|s)/); // Should match timing format
  });
});

test.describe('Data Consistency', () => {
  test('header duration should be displayed correctly', async ({ page, gotoDashboardPage }) => {
    const traceId = await getLastTraceId();
    
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({
        'var-traceId': traceId,
      }),
    });

    await expect(page.getByTestId(PANEL_HEADER_TESTID)).toBeVisible({ timeout: TIMEOUT.SHORT });

    // Use first() to handle multiple elements with same test ID
    const headerDurationElement = page.getByTestId('header-duration').first();
    await expect(headerDurationElement).toBeVisible();
    
    const headerDuration = await headerDurationElement.textContent();
    expect(headerDuration).toBeTruthy();
    expect(headerDuration).toMatch(/\d+(\.\d+)?(ms|s)/); // Should match timing format
    
    // Verify the header duration makes sense (not empty or invalid)
    expect(headerDuration!.trim()).not.toBe('');
  });
});

test.describe('Error States', () => {
  test('should handle no data state correctly', async ({ page, gotoDashboardPage }) => {
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({
        'var-traceId': INVALID_TRACE_ID,
      }),
    });

    await expect(page.getByTestId(PANEL_HEADER_TESTID)).toBeVisible({ timeout: TIMEOUT.SHORT });
    await expect(page.locator('text=No trace data available for this query')).toBeVisible({ timeout: TIMEOUT.MEDIUM });
  });

  test('should handle empty trace id', async ({ page, gotoDashboardPage }) => {
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({
        'var-traceId': '',
      }),
    });

    await expect(page.getByTestId(PANEL_HEADER_TESTID)).toBeVisible({ timeout: TIMEOUT.SHORT });
    await expect(page.locator('text=No trace data available for this query')).toBeVisible({ timeout: TIMEOUT.MEDIUM });
  });
});

test.describe('Responsive Behavior', () => {
  test('should display panel too small warning when panel is too small', async ({ page, gotoDashboardPage }) => {
    const traceId = await getLastTraceId();

    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({
        'var-traceId': traceId,
      }),
    });

    await expect(page.getByTestId(PANEL_HEADER_TESTID)).toBeVisible({ timeout: TIMEOUT.SHORT });

    await page.setViewportSize({ width: 400, height: 200 });

    await expect(page.locator('text=Panel too small')).toBeVisible({ timeout: TIMEOUT.SHORT });
    await expect(page.locator('text=Current panel size is')).toBeVisible();
  });

  test('should handle normal panel size correctly', async ({ page, gotoDashboardPage }) => {
    const traceId = await getLastTraceId();

    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({
        'var-traceId': traceId,
      }),
    });

    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(page.getByTestId(PANEL_HEADER_TESTID)).toBeVisible({ timeout: TIMEOUT.SHORT });
    
    await expect(page.locator('text=Panel too small')).not.toBeVisible();
    await expect(page.getByTestId('span-name-MissionControl')).toBeVisible();
  });
});
