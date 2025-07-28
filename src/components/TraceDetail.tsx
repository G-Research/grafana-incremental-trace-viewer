import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Icon } from '@grafana/ui';

import { testIds } from './testIds';
import { Span as SpanComponent, SpanDetailPanel } from './Span';
import {
  mkMilisecondsFromNanoSeconds,
  mkUnixEpochFromNanoSeconds,
  mkUnixEpochFromMiliseconds,
} from '../utils/utils.timeline';
import { search, SearchResponse, Span } from '../utils/utils.api';
import type { QueryInfo as TraceDetailProps } from './TraceViewerPanel';
import { SpanOverlayDrawer } from './Span/SpanOverlayDrawer';
import { HelpModal } from './HelpModal';

// default Grafana does not support child count.
// In production, we use a custom build of Grafana that supports child count.
// This value is set at build time via environment variable SUPPORTS_CHILD_COUNT
const supportsChildCount = process.env.SUPPORTS_CHILD_COUNT || false;

export type SpanInfo = {
  spanId: string;
  parentSpanId: string | null;
  traceId: string;
  level: number;
  startTimeUnixNano: number;
  endTimeUnixNano: number;
  name: string;
  hasMore: boolean;
};

function getParentSpanId(span: Span): string | null {
  const attributes = span.attributes;
  if (!attributes) {
    return null;
  }
  const parentSpanId = attributes.find((a) => a.key === 'span:parentID')?.value?.stringValue;
  return parentSpanId || null;
}

async function hasChildren(
  datasourceUid: string,
  traceId: string,
  spanId: string,
  startTimeUnixNano: number,
  endTimeUnixNano: number
): Promise<boolean> {
  const q = `{ trace:id = "${traceId}" && span:parentID = "${spanId}" } | count() > 0`;
  const start = mkUnixEpochFromNanoSeconds(startTimeUnixNano);
  // As a precaution, we add 1 second to the end time.
  // This is to avoid any rounding errors where the microseconds or nanoseconds are not included in the end time.
  const end = mkUnixEpochFromNanoSeconds(endTimeUnixNano) + 1;
  const data = await search(datasourceUid, q, start, end, 1);
  return (data.traces && data.traces.length > 0) || false;
}

/**
 * Extracts and maps span nodes from the search response to a list of SpanInfo objects.
 * Assigns a hierarchical level to each span based on its parent-child relationship.
 * Optionally determines if a span has more children, setting the hasMore flag accordingly.
 *
 * @param idToLevelMap - A map tracking the hierarchical level of each span by span ID.
 * @param traceId - The ID of the trace to extract spans from.
 * @param datasourceUid - The UID of the datasource to use for fetching additional span information.
 * @param responseData - The search response containing trace and span data.
 * @param fixedHasMore - If provided, sets the hasMore flag for all spans to this value instead of checking for children.
 * @returns Promise<SpanInfo[]>
 */
async function extractSpans(
  idToLevelMap: Map<string, number>,
  traceId: string,
  datasourceUid: string,
  responseData: SearchResponse,
  fixedHasMore?: boolean
): Promise<SpanInfo[]> {
  const trace = responseData.traces?.find((t) => t.traceID === traceId);
  if (!trace) {
    throw new Error(`Trace not found for ${traceId}`);
  }

  let spanNodes = trace.spanSets?.flatMap((r) => r.spans || []) || [];

  spanNodes.sort((a, b) => {
    const start = parseInt(a.startTimeUnixNano || '0', 10) - parseInt(b.startTimeUnixNano || '0', 10);
    const end = parseInt(b.durationNanos || '0', 10) - parseInt(a.durationNanos || '0', 10);
    return start || end;
  });

  const spans: SpanInfo[] = [];
  for (let i = 0; i < spanNodes.length; i++) {
    const span = spanNodes[i];
    if (!span.spanID) {
      continue;
    }

    const parentSpanId = getParentSpanId(span);

    // Assign the level to the span.
    if (parentSpanId === null) {
      idToLevelMap.set(span.spanID, 0);
    } else {
      let parentLevel = idToLevelMap.get(parentSpanId);
      if (parentLevel === undefined) {
        throw new Error(`Parent level not found for ${span.spanID}`);
      }
      idToLevelMap.set(span.spanID, parentLevel + 1);
    }

    const startTimeUnixNano = parseInt(span.startTimeUnixNano || '0', 10);
    const durationNanos = parseInt(span.durationNanos || '0', 10);
    const endTimeUnixNano = startTimeUnixNano + durationNanos;
    // This is a rather expensive call.
    // We need to call this for every span.
    let hasMore = false;
    if (fixedHasMore !== undefined) {
      hasMore = fixedHasMore;
    } else {
      // Assuming that the childCount is set by the backend.
      // We can just use that value to determine if the span has more children.
      const childCount = span.attributes?.find((a) => a.key === 'childCount')?.value?.intValue;
      if (childCount !== undefined) {
        hasMore = childCount > 0;
      } else {
        // If not, we need to fetch the children count via additional query.
        hasMore = await hasChildren(datasourceUid, traceId, span.spanID, startTimeUnixNano, endTimeUnixNano);
      }
    }

    spans.push({
      spanId: span.spanID,
      parentSpanId: parentSpanId,
      traceId: traceId,
      level: idToLevelMap.get(span.spanID) || 0,
      startTimeUnixNano: startTimeUnixNano,
      endTimeUnixNano: endTimeUnixNano,
      name: span.name || '',
      hasMore: hasMore,
    });
  }
  return spans;
}

async function loadMoreSpans(
  traceId: string,
  datasourceUid: string,
  idToLevelMap: Map<string, number>,
  span: SpanInfo
): Promise<SpanInfo[]> {
  const q = `{ trace:id = "${traceId}" && span:parentID = "${span.spanId}" } | select (span:parentID, span:name${
    supportsChildCount ? ', childCount' : ''
  })`;
  const start = mkUnixEpochFromNanoSeconds(span.startTimeUnixNano);
  // As a precaution, we add 1 second to the end time.
  // This is to avoid any rounding errors where the microseconds or nanoseconds are not included in the end time.
  const end = mkUnixEpochFromNanoSeconds(span.endTimeUnixNano) + 1;
  // See https://github.com/grafana/tempo/issues/5435
  const data = await search(datasourceUid, q, start, end, 4294967295);
  return await extractSpans(idToLevelMap, traceId, datasourceUid, data);
}

function TraceDetail({ traceId, datasourceUid, startTimeInMs, panelWidth }: TraceDetailProps): React.JSX.Element {
  // Should we assert for traceId and datasourceId?
  if (!traceId || !datasourceUid) {
    throw new Error('traceId and datasourceId are required');
  }

  const queryClient = useQueryClient();
  const parentRef = React.useRef(null);
  const queryKey = ['datasource', datasourceUid, 'trace', traceId];
  const [selectedSpan, setSelectedSpan] = React.useState<SpanInfo | null>(null);
  const [showHelpModal, setShowHelpModal] = React.useState(false);

  const idToLevelMap = React.useRef(new Map<string, number>());

  const result = useQuery<SpanInfo[]>(
    {
      queryKey,
      staleTime: 5000,
      queryFn: async () => {
        const start = mkUnixEpochFromMiliseconds(startTimeInMs);
        const end = start + 1;
        const q = `{ trace:id = "${traceId}" && nestedSetParent = -1 } | select (span:name${
          supportsChildCount ? ', childCount' : ''
        })`;
        const data = await search(datasourceUid, q, start, end);
        // We pass in hasMore: false because we are fetching the first round of children later.
        const spans: SpanInfo[] = await extractSpans(idToLevelMap.current, traceId, datasourceUid, data, false);
        const allSpans = [];
        // We fetch the first round of children for each span.
        for (const span of spans) {
          allSpans.push(span);
          const moreSpans = await loadMoreSpans(traceId, datasourceUid, idToLevelMap.current, span);
          allSpans.push(...moreSpans);
        }
        return allSpans;
      },
    },
    queryClient
  );

  const traceDurationInMiliseconds = React.useMemo(() => {
    if (!result.isSuccess || result.data.length === 0) {
      return 0;
    }
    const rootSpan = result.data[0];
    return (
      mkMilisecondsFromNanoSeconds(rootSpan.endTimeUnixNano) - mkMilisecondsFromNanoSeconds(rootSpan.startTimeUnixNano)
    );
  }, [result.isSuccess, result.data]);

  const traceStartTimeInMiliseconds = React.useMemo(() => {
    if (!result.isSuccess || result.data.length === 0) {
      return 0;
    }
    const rootSpan = result.data[0];
    // TODO: not sure if this will work as is in nano seconds.
    return new Date(mkMilisecondsFromNanoSeconds(rootSpan.startTimeUnixNano)).getTime();
  }, [result.isSuccess, result.data]);

  const rowVirtualizer = useVirtualizer({
    count: result.isSuccess ? result.data.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    // Potential solution to add sticky headers
    // rangeExtractor: (range) => {}
  });

  const loadMore = (index: number, span: SpanInfo) => {
    if (!result.isSuccess) {
      return;
    }

    new Promise(async () => {
      const q = `{ trace:id = "${traceId}" && span:parentID = "${span.spanId}" } | select (span:parentID, span:name${
        supportsChildCount ? ', childCount' : ''
      })`;
      const start = mkUnixEpochFromNanoSeconds(span.startTimeUnixNano);
      // As a precaution, we add 1 second to the end time.
      // This is to avoid any rounding errors where the microseconds or nanoseconds are not included in the end time.
      const end = mkUnixEpochFromNanoSeconds(span.endTimeUnixNano) + 1;
      // See https://github.com/grafana/tempo/issues/5435
      const data = await search(datasourceUid, q, start, end, 4294967295);
      const spans = await extractSpans(idToLevelMap.current, traceId, datasourceUid, data);

      queryClient.setQueryData<SpanInfo[]>(queryKey, (oldData) => {
        if (!oldData) {
          return spans;
        }

        let nextSpans: SpanInfo[] = [];
        let didAddNewSpans = false;

        for (let i = 0; i < oldData.length; i++) {
          // Add all spans before the current span.
          if (i <= index) {
            nextSpans.push(oldData[i]);
            continue;
          }

          if (i === index + 1) {
            // Add the new spans after their parent span.
            for (let c = 0; c < spans.length; c++) {
              nextSpans.push(spans[c]);
            }
            didAddNewSpans = true;
          }

          nextSpans.push(oldData[i]);
        }

        if (!didAddNewSpans) {
          nextSpans.push(...spans);
        }

        nextSpans[index].hasMore = false;

        return nextSpans;
      });
    });
  };

  return (
    <div className="flex h-[calc(100vh-120px)] relative">
      <div className="flex-grow flex flex-col">
        <div className="flex bg-gray-800 p-2 border-b border-gray-700">
          <div className="w-1/3 font-bold flex items-center justify-between">
            <span>Span</span>
            <button
              onClick={() => setShowHelpModal(true)}
              className="p-1 rounded hover:bg-gray-700 transition-colors"
              title="Get help"
            >
              <Icon name="info-circle" className="text-gray-400 hover:text-white w-4 h-4" />
            </button>
          </div>
          <div className="w-2/3 font-bold px-4">
            <div className="w-full relative">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute border-l border-gray-500 h-2 pl-1 text-xs"
                  style={{
                    left: `${(i / 4) * 100}%`,
                  }} // Limitation in tailwind dynamic class construction: Check README.md for more details
                >
                  {((traceDurationInMiliseconds / 1000 / 4) * i).toFixed(2)}s
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex-grow" data-testid={testIds.pageThree.container}>
          {result.isLoading && <div>Loading...</div>}
          {result.isError && <div>Error: {result.error.message}</div>}
          {result.isSuccess && (
            <div ref={parentRef} className="h-full overflow-auto">
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                }} // Limitation in tailwind dynamic class construction: Check README.md for more details
                className="w-full relative"
              >
                {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                  const span = result.data[virtualItem.index];
                  const hasChildren =
                    virtualItem.index !== result.data.length - 1 &&
                    result.data[virtualItem.index + 1].parentSpanId === span.spanId;
                  return (
                    <div
                      key={virtualItem.key}
                      className="absolute top-0 left-0 w-full border-b border-[#2d2d2d]"
                      style={{
                        height: `${virtualItem.size}px`,
                        transform: `translateY(${virtualItem.start}px)`,
                      }} // Limitation in tailwind dynamic class construction: Check README.md for more details
                    >
                      <SpanComponent
                        key={span.spanId}
                        {...span}
                        index={virtualItem.index}
                        loadMore={loadMore}
                        traceStartTimeInMiliseconds={traceStartTimeInMiliseconds}
                        traceDurationInMiliseconds={traceDurationInMiliseconds}
                        onSelect={setSelectedSpan}
                        hasChildren={hasChildren}
                        isSelected={selectedSpan?.spanId === span.spanId}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      <SpanOverlayDrawer
        isOpen={!!selectedSpan}
        onClose={() => setSelectedSpan(null)}
        title="Span Details"
        panelWidth={panelWidth || window.innerWidth}
      >
        {selectedSpan && (
          <SpanDetailPanel span={selectedSpan} onClose={() => setSelectedSpan(null)} datasourceUid={datasourceUid} />
        )}
      </SpanOverlayDrawer>
      <HelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        type="general-help"
        currentWidth={panelWidth}
        currentHeight={window.innerHeight}
      />
    </div>
  );
}

export default TraceDetail;
