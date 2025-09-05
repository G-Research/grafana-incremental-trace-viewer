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
