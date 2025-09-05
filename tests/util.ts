export async function getLastTraceId(): Promise<string> {
  const end = Math.floor(new Date().getTime() / 1000);
  const start = end - 24 * 60 * 60;
  const q = '{}';
  const url = `http://localhost:3200/api/search?q=${encodeURIComponent(q)}&start=${start}&end=${end}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data?.traces?.length) {
      throw new Error('No traces found in response');
    }

    const traceId = data.traces[0]?.traceID;
    if (!traceId) {
      throw new Error('No trace ID found in first trace');
    }

    return traceId;
  } catch (error) {
    console.error('Failed to fetch trace ID:', error);
    throw error;
  }
}
