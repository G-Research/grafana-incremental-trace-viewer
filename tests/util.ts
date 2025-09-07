export async function getLastTraceId() {
  // Current time in seconds
  const end = Math.floor(new Date().getTime() / 1000);
  // Minus one day
  const start = end - 24 * 60 * 60;
  const q = '{}';
  const url = `http://localhost:3200/api/search?q=${encodeURIComponent(q)}&start=${start}&end=${end}`;
  const response = await fetch(url);
  const data = await response.json();
  return data.traces[0].traceID;
}

export async function gotoTraceViewerDashboard(gotoDashboardPage, traceId?: string) {
  const traceIdToUse = traceId || (await getLastTraceId());
  await gotoDashboardPage({
    uid: 'gr-trace-viewer-dashboard',
    queryParams: new URLSearchParams({
      'var-traceId': traceIdToUse,
    }),
  });
}

export async function waitForDashboardLoad(page: any, timeout = 30000) {
  // Wait for the panel to be visible instead of networkidle which can be unreliable in Grafana 10.x
  try {
    await page.waitForLoadState('networkidle', { timeout });
  } catch {
    // Fallback: wait for span elements to appear as an indicator that the dashboard has loaded
    // This is more reliable than waiting for a panel header that might not exist
    await page.waitForSelector('[data-testid^="span-name-"]', { timeout });
  }
}
