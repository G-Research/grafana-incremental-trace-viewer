import React from 'react';
import { useParams } from 'react-router-dom';
import { testIds } from '../components/testIds';
import { getBackendSrv, PluginPage } from '@grafana/runtime';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { lastValueFrom } from 'rxjs';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ApiPaths, type components } from '../schema.gen';
import type { datasource } from './TraceOverview';
import { BASE_URL } from '../constants';
import { Span as SpanComponent, SpanDetailPanel } from '../components/Span';

type TraceResponse = components['schemas']['TracesData'];
type DataSourceInfo = components['schemas']['DataSourceInfo'];

export type Span = {
  spanID: string;
  parentSpanId: string | null;
  traceId: string;
  level: number;
  startTimeUnixNano: number;
  endTimeUnixNano: number;
  name: string;
  hasMore: boolean;
};

function spanIdAsString(spanID: number[]): string {
  return String.fromCodePoint(...spanID);
}

/**
 * Maps the span nodes to a list of spans.
 * It also assigns the level to the span.
 * It also sets the hasMore flag to true for the parent span if it has more children.
 * Skips the take + 1 elements.
 * @param spanNodes
 * @param idToLevelMap
 * @returns Span[]
 */
function extractSpans(idToLevelMap: Map<string, number>, responseData: TraceResponse): Span[] {
  const spanNodes = responseData.resourceSpans?.flatMap((r) => r.scopeSpans?.flatMap((s) => s.spans || []) || []) || [];

  const spans: Span[] = [];
  for (let i = 0; i < spanNodes.length; i++) {
    const span = spanNodes[i];
    if (!span.spanID) {
      continue;
    }

    // Assign the level to the span.
    if (!span.parentSpanId || span.parentSpanId.length === 0) {
      idToLevelMap.set(spanIdAsString(span.spanID), 0);
    } else {
      let parentLevel = idToLevelMap.get(spanIdAsString(span.parentSpanId));
      if (parentLevel === undefined) {
        throw new Error(`Parent level not found for ${spanIdAsString(span.spanID)}`);
      }
      idToLevelMap.set(spanIdAsString(span.spanID), parentLevel + 1);
    }

    // Skip the take + 1 elements.
    if (i > take) {
      let parentNode = spanNodes[i - take - 1];
      // If this element is <take> removed from the array, we can skip it.
      // It does indicate that the parent has more children.
      if (parentNode.spanID && span.parentSpanId && isIdEqual(parentNode.spanID, span.parentSpanId)) {
        const parent = spans[spans.length - take - 1];
        if (parent.spanID === spanIdAsString(parentNode.spanID)) {
          parent.hasMore = true;
        } else {
          console.warn(`Parent span ${spanIdAsString(parentNode.spanID)} is not ${take} removed from take + 1 child`);
        }
        console.info(`Skipping ${span.name} because`);
        continue;
      }
    }

    spans.push({
      spanID: spanIdAsString(span.spanID),
      parentSpanId: span.parentSpanId ? spanIdAsString(span.parentSpanId) : null,
      traceId: spanIdAsString(span.traceId || []),
      level: idToLevelMap.get(spanIdAsString(span.spanID)) || 0,
      startTimeUnixNano: span.startTimeUnixNano || 0,
      endTimeUnixNano: span.endTimeUnixNano || 0,
      name: span.name || '',
      // We determine this above.
      hasMore: false,
    });
  }
  return spans;
}

// TODO: consider making this configurable by the user.
const take = 10;

function isIdEqual(id1: number[], id2: number[]): boolean {
  if (id1.length !== id2.length) {
    return false;
  }
  for (let i = 0; i < id1.length; i++) {
    if (id1[i] !== id2[i]) {
      return false;
    }
  }
  return true;
}

function TraceDetail() {
  const { traceId, datasourceId } = useParams<{ traceId: string; datasourceId: string }>();
  // Should we assert for traceId and datasourceId?
  if (!traceId || !datasourceId) {
    throw new Error('traceId and datasourceId are required');
  }

  const queryClient = useQueryClient();
  const parentRef = React.useRef(null);
  const queryKey = ['datasource', datasourceId, 'trace', traceId];
  const [selectedSpan, setSelectedSpan] = React.useState<Span | null>(null);

  const idToLevelMap = React.useRef(new Map<string, number>());

  const result = useQuery<Span[]>(
    {
      queryKey,
      staleTime: 5000,
      queryFn: async () => {
        const backendSrv = getBackendSrv();

        // If the user came from the overview page, the datasource is already in the query client.
        let datasource = queryClient.getQueryData<datasource>(['datasource', datasourceId]);
        // If not, gets it from the API.
        if (datasource === undefined) {
          datasource = await lastValueFrom(
            backendSrv.fetch<datasource>({ url: `/api/datasources/${datasourceId}` })
          ).then((res) => res.data);
          queryClient.setQueryData<datasource>(['datasource', datasourceId], datasource);
        }
        // If the datasource is still undefined, throw an error.
        if (datasource === undefined) {
          throw new Error(`Datasource not found for ${datasourceId}`);
        }

        const responses = getBackendSrv().fetch<TraceResponse>({
          url: `${BASE_URL}${ApiPaths.queryTrace.replace('{traceId}', traceId)}?depth=3&take=${take + 1}`,
          method: 'POST',
          data: {
            type: datasource.type,
            url: datasource.url,
            database: datasource.jsonData.database,
            timeField: datasource.jsonData.timeField,
          } satisfies DataSourceInfo,
        });
        const response = await lastValueFrom(responses);
        const spans: Span[] = extractSpans(idToLevelMap.current, response.data);
        return spans;
      },
    },
    queryClient
  );

  const traceDuration = React.useMemo(() => {
    if (!result.isSuccess || result.data.length === 0) {
      return 0;
    }
    const rootSpan = result.data[0];
    return rootSpan.endTimeUnixNano - rootSpan.startTimeUnixNano;
  }, [result.isSuccess, result.data]);

  const traceStartTime = React.useMemo(() => {
    if (!result.isSuccess || result.data.length === 0) {
      return 0;
    }
    const rootSpan = result.data[0];
    // TODO: not sure if this will work as is in nano seconds.
    return new Date(rootSpan.startTimeUnixNano).getTime();
  }, [result.isSuccess, result.data]);

  const rowVirtualizer = useVirtualizer({
    count: result.isSuccess ? result.data.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    // Potential solution to add sticky headers
    // rangeExtractor: (range) => {}
  });

  const loadMore = (index: number, spanID: string, currentLevel: number) => {
    if (!result.isSuccess) {
      return;
    }

    let skip = 0;
    for (let i = index + 1; i < result.data.length; i++) {
      if (result.data[i].parentSpanId !== spanID) {
        break;
      }
      skip++;
    }

    new Promise(async () => {
      const datasource = queryClient.getQueryData<datasource>(['datasource', datasourceId]);
      if (!datasource) {
        throw new Error(`Datasource not found for ${datasourceId}`);
      }

      const responses = getBackendSrv().fetch<TraceResponse>({
        url: `${BASE_URL}${ApiPaths.queryTrace.replace('{traceId}', traceId)}?spanID=${spanID}&depth=3&take=${
          take + 1
        }&skip=${skip}`,
        method: 'POST',
        data: {
          type: datasource.type,
          url: datasource.url,
          database: datasource.jsonData.database,
          timeField: datasource.jsonData.timeField,
        } satisfies DataSourceInfo,
      });
      const response = await lastValueFrom(responses);
      const spans = extractSpans(idToLevelMap.current, response.data);

      queryClient.setQueryData<Span[]>(queryKey, (oldData) => {
        if (!oldData) {
          return spans;
        }

        let nextSpans: Span[] = [];
        let didAddNewSpans = false;

        for (let i = 0; i < oldData.length; i++) {
          // Add all spans before the current span.
          if (i <= index) {
            nextSpans.push(oldData[i]);
            continue;
          }

          // Find the next span with the same level, effectively being a sibling of the current span.
          if (i > index && oldData[i].level === currentLevel) {
            // Add the new spans before the next span with the same level.
            let directChildrenCount = 0; // increment each span that has the same parentSpanId
            for (let c = 0; c < spans.length; c++) {
              if (spans[c].parentSpanId === spanID) {
                directChildrenCount++;
              }
              nextSpans.push(spans[c]);
            }

            nextSpans[index].hasMore = directChildrenCount > take;
            didAddNewSpans = true;
          }

          nextSpans.push(oldData[i]);
        }

        if (!didAddNewSpans) {
          nextSpans.push(...spans);
        }

        return nextSpans;
      });
    });
  };

  return (
    <PluginPage>
      <div className="flex h-[calc(100vh-120px)]">
        <div className="flex-grow flex flex-col">
          <div className="flex bg-gray-800 p-2 border-b border-gray-700">
            <div className="w-1/3 font-bold">Span</div>
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
                    {((traceDuration / 1000 / 4) * i).toFixed(2)}s
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
                      result.data[virtualItem.index + 1].parentSpanId === span.spanID;
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
                          key={span.spanID}
                          {...span}
                          index={virtualItem.index}
                          loadMore={loadMore}
                          traceStartTime={traceStartTime}
                          traceDuration={traceDuration}
                          onSelect={setSelectedSpan}
                          hasChildren={hasChildren}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        {selectedSpan && (
          <div className="w-1/3 border-l border-gray-700 min-w-[300px]">
            <SpanDetailPanel span={selectedSpan} onClose={() => setSelectedSpan(null)} />
          </div>
        )}
      </div>
    </PluginPage>
  );
}

export default TraceDetail;
