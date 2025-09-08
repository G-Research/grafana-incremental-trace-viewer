import { test, expect } from '@grafana/plugin-e2e';

const TIMEOUT = {
  SHORT: 5000,
  MEDIUM: 10000,
  LONG: 15000,
} as const;

async function getLastTraceId() {
  const end = Math.floor(new Date().getTime() / 1000);
  const start = end - 24 * 60 * 60;
  const q = '{}';
  const url = `http://localhost:3200/api/search?q=${encodeURIComponent(q)}&start=${start}&end=${end}`;
  const response = await fetch(url);
  const data = await response.json();
  return data.traces[0].traceID;
}

async function gotoTraceViewerDashboard(gotoDashboardPage, traceId?: string) {
  const traceIdToUse = traceId || (await getLastTraceId());
  await gotoDashboardPage({
    uid: 'gr-trace-viewer-dashboard',
    queryParams: new URLSearchParams({
      'var-traceId': traceIdToUse,
    }),
  });
}

async function waitForDashboardLoad(page: any, timeout = 30000) {
  try {
    await page.waitForLoadState('networkidle', { timeout });
  } catch {
    // Grafana 10.x support
    await page.waitForSelector('[data-testid^="span-name-"]', { timeout });
  }
}

test.describe('Span Overview Display', () => {
  test.beforeEach(async ({ page, gotoDashboardPage }) => {
    await gotoTraceViewerDashboard(gotoDashboardPage);
    await waitForDashboardLoad(page, TIMEOUT.LONG);
  });

  test('should display root span with correct name on initial render', async ({ page }) => {
    const rootSpanNameElement = page.getByTestId('span-name-MissionControl');
    await expect(rootSpanNameElement).toBeVisible();
    await expect(rootSpanNameElement).toHaveText('MissionControl');
  });

  test('should display multiple spans when available', async ({ page }) => {
    const spanElements = page.getByTestId('span-row');
    await expect(spanElements.first()).toBeVisible();
    const spanCount = await spanElements.count();
    expect(spanCount).toBe(4);
  });

  test('should display span structure correctly', async ({ page }) => {
    const spanDurationElements = page.locator('.span-duration');
    console.log('spanDurationElements', spanDurationElements);
    const durationCount = await spanDurationElements.count();
    expect(durationCount).toBe(4);

    await expect(spanDurationElements.first()).toBeVisible();

    const spanNames = page.getByTestId('span-name');
    const nameCount = await spanNames.count();
    expect(nameCount).toBe(4);
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
    expect(durationText).toMatch(/\d+(\.\d+)?(ms|s)/);
  });
});

test.describe('Data Consistency', () => {
  test.beforeEach(async ({ page, gotoDashboardPage }) => {
    await gotoTraceViewerDashboard(gotoDashboardPage);
    await waitForDashboardLoad(page, TIMEOUT.LONG);
  });

  test('header duration should be displayed correctly', async ({ page }) => {
    const headerDurationElement = page.getByTestId('header-duration').first();
    await expect(headerDurationElement).toBeVisible();

    const headerDuration = await headerDurationElement.textContent();
    expect(headerDuration).toBeTruthy();
    expect(headerDuration).toMatch(/\d+(\.\d+)?(ms|s)/);

    expect(headerDuration!.trim()).not.toBe('');
  });
});
