import { test, expect } from '@grafana/plugin-e2e';
import { getLastTraceId, gotoTraceViewerDashboard, waitForDashboardLoad } from './util';

const TIMEOUT = {
  SHORT: 5000,
  MEDIUM: 10000,
  LONG: 15000,
} as const;

const PANEL_HEADER_TESTID = 'data-testid Panel header Incremental Trace Viewer' as const;

test.describe('Span Overview Display', () => {
  test.beforeEach(async ({ page, gotoDashboardPage }) => {
    await gotoTraceViewerDashboard(gotoDashboardPage);
    await waitForDashboardLoad(page, TIMEOUT.LONG);
  });

  test('should display root span with correct name on initial render', async ({ page }) => {
    await expect(page.getByTestId(PANEL_HEADER_TESTID)).toBeVisible({ timeout: TIMEOUT.SHORT });

    const rootSpanNameElement = page.getByTestId('span-name-MissionControl');
    await expect(rootSpanNameElement).toBeVisible();
    await expect(rootSpanNameElement).toHaveText('MissionControl');
  });

  test('should display multiple spans when available', async ({ page }) => {
    await expect(page.getByTestId(PANEL_HEADER_TESTID)).toBeVisible({ timeout: TIMEOUT.SHORT });

    const spanElements = page.locator('.span-row');
    await expect(spanElements.first()).toBeVisible();
    const spanCount = await spanElements.count();
    expect(spanCount).toBeGreaterThan(0);
  });

  test('should display span structure correctly', async ({ page }) => {
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
  test.beforeEach(async ({ page, gotoDashboardPage }) => {
    await gotoTraceViewerDashboard(gotoDashboardPage);
    await waitForDashboardLoad(page, TIMEOUT.LONG);
  });

  test('should display trace id in header', async ({ page }) => {
    const traceId = await getLastTraceId();
    const headerTraceId = page.getByTestId('header-trace-id');
    await expect(headerTraceId).toBeVisible();
    await expect(headerTraceId).toHaveText(traceId.slice(0, 8));
  });

  test('should display header duration', async ({ page }) => {
    const headerDuration = page.getByTestId('header-duration').first();
    await expect(headerDuration).toBeVisible();
    const durationText = await headerDuration.textContent();
    expect(durationText).toBeTruthy();
    expect(durationText).toMatch(/\d+(\.\d+)?(ms|s)/); // Should match timing format
  });
});

test.describe('Data Consistency', () => {
  test.beforeEach(async ({ page, gotoDashboardPage }) => {
    await gotoTraceViewerDashboard(gotoDashboardPage);
    await waitForDashboardLoad(page, TIMEOUT.LONG);
  });

  test('header duration should be displayed correctly', async ({ page }) => {
    await expect(page.getByTestId(PANEL_HEADER_TESTID)).toBeVisible({ timeout: TIMEOUT.SHORT });

    const headerDurationElement = page.getByTestId('header-duration').first();
    await expect(headerDurationElement).toBeVisible();

    const headerDuration = await headerDurationElement.textContent();
    expect(headerDuration).toBeTruthy();
    expect(headerDuration).toMatch(/\d+(\.\d+)?(ms|s)/); // Should match timing format

    // Verify the header duration makes sense (not empty or invalid)
    expect(headerDuration!.trim()).not.toBe('');
  });
});
