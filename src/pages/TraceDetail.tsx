import React from 'react';
import { css } from '@emotion/css';
import { useParams } from 'react-router-dom';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Button } from '@grafana/ui';
import { testIds } from '../components/testIds';
import { getBackendSrv, PluginPage } from '@grafana/runtime';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import plugin from '../plugin.json';
import { lastValueFrom } from 'rxjs';
import { useVirtualizer } from '@tanstack/react-virtual';

type TraceId = string;
type SpanId = string;
type ISODateString = string;

interface SpanNode {
  // The number of children that have been loaded so far
  currentChildrenCount: number;
  traceId: TraceId;
  spanId: SpanId;
  name: string;
  startTime: ISODateString;
  endTime: ISODateString;
  parentSpanId: SpanId;
  level: number;
  totalChildrenCount: number;
}

type SpanNodeProps = SpanNode & {
  index: number;
  loadMore: (index: number, spanId: string, currentLevel: number, skip: number) => void;
};

function getMillisecondsDifferenceNative(startTime: ISODateString, endTime: ISODateString) {
  const s = new Date(startTime);
  const e = new Date(endTime);

  // Validate if the Date objects are valid (e.g., if parsing failed)
  if (isNaN(s.getTime()) || isNaN(e.getTime())) {
    throw new Error('Invalid ISO 8601 date string provided.');
  }

  return e.getTime() - s.getTime();
}

const Span = (props: SpanNodeProps) => {
  const s = useStyles2(getStyles);

  return (
    <div className={s.spanContainer} style={{ '--indent-level': props.level } as React.CSSProperties}>
      <div className={s.spanInfo}>
        <div className={s.spanField}>
          <strong>Name:</strong> {props.name}
        </div>
        <div className={s.spanField}>
          <strong>ID:</strong> {props.spanId}
        </div>
        <div className={s.spanField}>
          <strong>Duration:</strong> {getMillisecondsDifferenceNative(props.startTime, props.endTime)}ms
        </div>
        <div className={s.spanField}>
          <span>
            current children:
            {props.currentChildrenCount}
          </span>
        </div>
        <div className={s.spanField}>
          <span>total children: {props.totalChildrenCount}</span>
        </div>
        {props.currentChildrenCount < props.totalChildrenCount && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => props.loadMore(props.index, props.spanId, props.level, props.currentChildrenCount)}
          >
            Load more
          </Button>
        )}
      </div>
    </div>
  );
};

function TraceDetail() {
  const { traceId, spanId: rootSpanId } = useParams<{ traceId: string; spanId: string }>();
  const queryClient = useQueryClient();
  const parentRef = React.useRef(null);

  const result = useQuery<SpanNode[]>(
    {
      queryKey: ['trace', traceId, rootSpanId],
      staleTime: 5000,
      queryFn: () =>
        new Promise(async (resolve, _) => {
          const responses = getBackendSrv().fetch<SpanNode[]>({
            url: `/api/plugins/${plugin.id}/resources/trace/${traceId}/span/${rootSpanId}`, // ?depth=3&childrenLimit=3
          });
          const response = await lastValueFrom(responses);
          console.log(response.data);
          resolve(response.data);
        }),
    },
    queryClient
  );

  const rowVirtualizer = useVirtualizer({
    count: result.isSuccess ? result.data.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    // Potential solution to add sticky headers
    // rangeExtractor: (range) => {}
  });

  const loadMore = (index: number, spanId: string, currentLevel: number, skip: number) => {
    if (!result.isSuccess) {
      return;
    }
    new Promise(async () => {
      const responses = getBackendSrv().fetch<SpanNode[]>({
        url: `/api/plugins/${
          plugin.id
        }/resources/trace/${traceId}/span/${spanId}/children?childrenLimit=${3}&depth=${3}&level=${currentLevel}&skip=${skip}&take=${10}`,
        method: 'GET',
      });
      const response = await lastValueFrom(responses);

      const currentSpan = result.data[index];
      // Find the next span with the same level, if our level is 2, we want to find the next span with level 2
      // We insert all new data right before this index.
      let nextSpanWithSameLevel = undefined;
      for (let i = index + 1; i < result.data.length; i++) {
        if (result.data[i].level === currentSpan.level) {
          nextSpanWithSameLevel = i;
          break;
        }
      }
      if (nextSpanWithSameLevel === undefined) {
        nextSpanWithSameLevel = index + currentSpan.currentChildrenCount + 1;
      }

      const newlyAddedChildren = response.data.filter(({ level }: SpanNode) => currentLevel + 1 === level).length;

      queryClient.setQueryData<SpanNode[]>(['trace', traceId, rootSpanId], (oldData) => {
        if (!oldData) {
          console.log('oldData is undefined, returning response.data.spans');
          return response.data;
        }
        return currentLevel === 1
          ? // We requested more children for the root span, so we need to insert the new spans after the existing spans.
            [
              // root span
              {
                ...currentSpan,
                currentChildrenCount: currentSpan.currentChildrenCount + newlyAddedChildren,
              },
              // existing children
              ...oldData.slice(index + 1),
              // new children
              ...response.data,
            ]
          : // We need to carefully insert the new spans, we need to insert them before the next span with the same level.
            [
              // Copy everything before the current span
              ...oldData.slice(0, index),
              // Insert the current span with the new children count
              {
                ...currentSpan,
                currentChildrenCount: currentSpan.currentChildrenCount + newlyAddedChildren,
              },
              // existing children (could be nested)
              ...oldData.slice(index + 1, nextSpanWithSameLevel),
              // new children (could be nested)
              ...response.data,
              // Everything after the current span
              ...oldData.slice(index + currentSpan.currentChildrenCount + 1),
            ];
      });
    });
  };

  return (
    <PluginPage>
      <div data-testid={testIds.pageThree.container}>
        This is detail page for span {rootSpanId}
        <br />
        <br />
        {/* The ID parameter is set */}
        {rootSpanId && <strong>ID: {rootSpanId} </strong>}
      </div>
      {result.isLoading && <div>Loading...</div>}
      {result.isError && <div>Error: {result.error.message}</div>}
      {result.isSuccess && (
        /* The scrollable element for your list */
        <div
          ref={parentRef}
          style={{
            height: `60vh`,
            overflow: 'auto',
          }}
        >
          {/* The large inner element to hold all of the items */}
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {/* Only the visible items in the virtualizer, manually positioned to be in view */}
            {rowVirtualizer.getVirtualItems().map((virtualItem) => {
              const span = result.data[virtualItem.index];
              return (
                <div
                  key={virtualItem.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <Span key={span.spanId} {...span} index={virtualItem.index} loadMore={loadMore} />
                </div>
              );
            })}
          </div>
        </div>
      )}
      <pre>{JSON.stringify(result.data && result.data.length, null, 2)}</pre>
    </PluginPage>
  );
}

export default TraceDetail;

const getStyles = (theme: GrafanaTheme2) => ({
  spanContainer: css`
    border-left: 2px solid ${theme.colors.border.weak};
    padding-left: ${theme.spacing(1)};
    margin-bottom: ${theme.spacing(1)};
    margin-left: calc(${theme.spacing(2)} * var(--indent-level, 0));
    transition: background-color 0.2s ease;

    &:hover {
      background-color: ${theme.colors.background.secondary};
    }
  `,
  spanInfo: css`
    display: flex;
    align-content: center;
    gap: ${theme.spacing(1)};
    padding: ${theme.spacing(1)};
    background-color: ${theme.colors.background.primary};
    border: 1px solid ${theme.colors.border.weak};
    border-radius: ${theme.shape.borderRadius()};
  `,
  spanField: css`
    font-size: ${theme.typography.size.sm};

    &:last-child {
      margin-bottom: 0;
    }

    strong {
      color: ${theme.colors.text.primary};
      margin-right: ${theme.spacing(1)};
    }
  `,
});
