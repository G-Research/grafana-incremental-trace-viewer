import React, { useState, useMemo } from 'react';
import { css } from '@emotion/css';
import { useParams } from 'react-router-dom';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Icon } from '@grafana/ui';
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
  currentChildrenCount: number;
  traceId: TraceId;
  spanId: SpanId;
  name: string;
  startTime: ISODateString;
  endTime: ISODateString;
  parentSpanId: SpanId;
  level: number;
  totalChildrenCount: number;
  // Additional fields for enhanced trace viewer
  service?: string;
  attributes?: { [key: string]: any };
  events?: Array<{ timestamp: string; name: string; attributes?: { [key: string]: any } }>;
  status?: 'ok' | 'error' | 'timeout';
}

interface SpanNodeExtended extends SpanNode {
  isExpanded: boolean;
  isVisible: boolean;
  children?: SpanNodeExtended[];
}

type SpanNodeProps = SpanNodeExtended & {
  index: number;
  traceStartTime: number;
  traceDuration: number;
  onToggleExpand: (spanId: string) => void;
  onSelectSpan: (span: SpanNodeExtended) => void;
  selectedSpanId?: string;
  loadMore: (index: number, spanId: string, currentLevel: number, skip: number) => void;
};

function getMillisecondsDifferenceNative(startTime: ISODateString, endTime: ISODateString) {
  const s = new Date(startTime);
  const e = new Date(endTime);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) {
    throw new Error('Invalid ISO 8601 date string provided.');
  }
  return e.getTime() - s.getTime();
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(2)}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${(ms / 60000).toFixed(2)}m`;
}

// Service color registry to ensure unique colors per app
const serviceColors = new Map<string, string>();

function getSpanColor(service?: string, status?: string): string {
  if (status === 'error') {
    return '#dc2626';
  }
  if (status === 'timeout') {
    return '#ea580c';
  }

  if (!service) {
    return '#6b7280';
  }

  // Return existing color if already assigned
  if (serviceColors.has(service)) {
    return serviceColors.get(service)!;
  }

  // Extended color palette for more unique assignments
  const colors = [
    '#3b82f6',
    '#10b981',
    '#8b5cf6',
    '#f59e0b',
    '#ef4444',
    '#06b6d4',
    '#84cc16',
    '#f97316',
    '#ec4899',
    '#6366f1',
    '#14b8a6',
    '#a855f7',
    '#eab308',
    '#f43f5e',
    '#8b5cf6',
    '#22c55e',
    '#3b82f6',
    '#f59e0b',
    '#ef4444',
    '#06b6d4',
    '#84cc16',
    '#d946ef',
    '#0ea5e9',
    '#65a30d',
    '#dc2626',
    '#7c3aed',
    '#059669',
    '#ca8a04',
  ];

  // Assign next available color
  const usedColors = new Set(serviceColors.values());
  const availableColor = colors.find((color) => !usedColors.has(color)) || colors[serviceColors.size % colors.length];

  serviceColors.set(service, availableColor);
  return availableColor;
}

const TimelineHeader = ({ traceDuration, traceStartTime }: { traceDuration: number; traceStartTime: number }) => {
  const s = useStyles2(getStyles);

  const timeMarkers = useMemo(() => {
    const markers = [];
    const markerCount = 6;
    for (let i = 0; i <= markerCount; i++) {
      const timeOffset = (traceDuration * i) / markerCount;
      markers.push({
        position: (i / markerCount) * 100,
        time: formatDuration(timeOffset),
        absoluteTime: new Date(traceStartTime + timeOffset).toLocaleTimeString(),
      });
    }
    return markers;
  }, [traceDuration, traceStartTime]);

  return (
    <div className={s.timelineHeader}>
      <div className={s.timelineLabels}>
        <div className={s.spanColumn}>Span</div>
        <div className={s.serviceColumn}>&nbsp;</div>
        <div className={s.timelineColumn}>
          {timeMarkers.map((marker, i) => (
            <div key={i} className={s.timeMarker} style={{ left: `${marker.position}%` }}>
              {marker.time}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const SpanBar = ({
  span,
  traceStartTime,
  traceDuration,
}: {
  span: SpanNodeExtended;
  traceStartTime: number;
  traceDuration: number;
}) => {
  const s = useStyles2(getStyles);

  const spanStart = new Date(span.startTime).getTime();
  const spanDuration = getMillisecondsDifferenceNative(span.startTime, span.endTime);

  const leftPercent = ((spanStart - traceStartTime) / traceDuration) * 100;
  const widthPercent = (spanDuration / traceDuration) * 100;

  const color = getSpanColor(span.service, span.status);

  return (
    <div className={s.spanBarContainer}>
      <div
        className={s.spanBar}
        style={{
          left: `${Math.max(0, leftPercent)}%`,
          width: `${Math.max(0.5, widthPercent)}%`,
          backgroundColor: color,
        }}
        title={`${span.name} - ${formatDuration(spanDuration)}`}
      />
    </div>
  );
};

const Span = (props: SpanNodeProps) => {
  const s = useStyles2(getStyles);
  // const duration = getMillisecondsDifferenceNative(props.startTime, props.endTime);
  const hasChildren = props.totalChildrenCount > 0;
  const isSelected = props.selectedSpanId === props.spanId;

  return (
    <div
      className={`${s.spanRow} ${isSelected ? s.spanRowSelected : ''}`}
      style={{ '--indent-level': props.level } as React.CSSProperties}
      onClick={() => props.onSelectSpan(props)}
    >
      <div className={s.spanColumn}>
        <div className={s.spanInfo}>
          {hasChildren && (
            <button
              className={s.expandButton}
              onClick={(e) => {
                e.stopPropagation();
                if (props.currentChildrenCount < props.totalChildrenCount) {
                  // Load more children if not all are loaded
                  props.loadMore(props.index, props.spanId, props.level, props.currentChildrenCount);
                } else {
                  // Toggle expand/collapse if all children are loaded
                  props.onToggleExpand(props.spanId);
                }
              }}
              title={
                props.currentChildrenCount < props.totalChildrenCount
                  ? `Load ${props.totalChildrenCount - props.currentChildrenCount} more children`
                  : props.isExpanded
                  ? 'Collapse'
                  : 'Expand'
              }
            >
              <Icon
                name={
                  props.currentChildrenCount < props.totalChildrenCount
                    ? 'plus'
                    : props.isExpanded
                    ? 'angle-down'
                    : 'angle-right'
                }
                size="sm"
              />
            </button>
          )}
          {!hasChildren && <div className={s.expandSpacer} />}
          <div className={s.spanName}>{props.name}</div>
          {/* <div className={s.spanDuration}>{formatDuration(duration)}</div> */}
          {props.currentChildrenCount < props.totalChildrenCount && (
            <div className={s.loadMoreIndicator}>+{props.totalChildrenCount - props.currentChildrenCount}</div>
          )}
        </div>
      </div>

      <div className={s.serviceColumn}>
        <div className={s.serviceTag} style={{ backgroundColor: getSpanColor(props.name) }} />
      </div>

      <div className={s.timelineColumn}>
        <SpanBar span={props} traceStartTime={props.traceStartTime} traceDuration={props.traceDuration} />
      </div>
    </div>
  );
};

const SpanDetailSidebar = ({ span, onClose }: { span: SpanNodeExtended | null; onClose: () => void }) => {
  const s = useStyles2(getStyles);

  if (!span) {
    return null;
  }

  const duration = getMillisecondsDifferenceNative(span.startTime, span.endTime);

  return (
    <div className={s.sidebar}>
      <div className={s.sidebarHeader}>
        <h3>Span Details</h3>
        <button className={s.closeButton} onClick={onClose}>
          <Icon name="times" />
        </button>
      </div>

      <div className={s.sidebarContent}>
        <div className={s.sidebarSection}>
          <h4>Span Attributes</h4>
          <div className={s.attributeList}>
            <div className={s.attribute}>
              <strong>Operation:</strong> {span.name}
            </div>
            <div className={s.attribute}>
              <strong>Span ID:</strong> {span.spanId}
            </div>
            <div className={s.attribute}>
              <strong>Duration:</strong> {formatDuration(duration)}
            </div>
            <div className={s.attribute}>
              <strong>Start Time:</strong> {new Date(span.startTime).toLocaleString()}
            </div>
            <div className={s.attribute}>
              <strong>Service:</strong> {span.service || 'Unknown'}
            </div>
            {span.attributes &&
              Object.entries(span.attributes).map(([key, value]) => (
                <div key={key} className={s.attribute}>
                  <strong>{key}:</strong> {String(value)}
                </div>
              ))}
          </div>
        </div>

        {span.events && span.events.length > 0 && (
          <div className={s.sidebarSection}>
            <h4>Events</h4>
            <div className={s.eventList}>
              {span.events.map((event, i) => (
                <div key={i} className={s.event}>
                  <div className={s.eventTime}>{new Date(event.timestamp).toLocaleTimeString()}</div>
                  <div className={s.eventName}>{event.name}</div>
                  {event.attributes && (
                    <div className={s.eventAttributes}>
                      {Object.entries(event.attributes).map(([key, value]) => (
                        <div key={key} className={s.eventAttribute}>
                          {key}: {String(value)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function TraceDetail() {
  const { traceId, spanId: rootSpanId } = useParams<{ traceId: string; spanId: string }>();
  const queryClient = useQueryClient();
  const parentRef = React.useRef(null);
  const [expandedSpans, setExpandedSpans] = useState<Set<string>>(new Set());
  const [selectedSpan, setSelectedSpan] = useState<SpanNodeExtended | null>(null);
  const styles = useStyles2(getStyles);

  const result = useQuery<SpanNode[]>(
    {
      queryKey: ['trace', traceId, rootSpanId],
      staleTime: 5000,
      queryFn: () =>
        new Promise(async (resolve, _) => {
          const responses = getBackendSrv().fetch<SpanNode[]>({
            url: `/api/plugins/${plugin.id}/resources/trace/${traceId}/span/${rootSpanId}`,
          });
          const response = await lastValueFrom(responses);
          console.log(response.data);
          resolve(response.data);
        }),
    },
    queryClient
  );

  // Process spans for tree structure and visibility
  const processedSpans = useMemo(() => {
    if (!result.isSuccess || !result.data) {
      return [];
    }

    return result.data.map(
      (span): SpanNodeExtended => ({
        ...span,
        isExpanded: expandedSpans.has(span.spanId),
        isVisible: true, // For now, all loaded spans are visible
      })
    );
  }, [result.data, result.isSuccess, expandedSpans]);

  // Calculate trace timing information
  const traceTimingInfo = useMemo(() => {
    if (!result.isSuccess || !result.data || result.data.length === 0) {
      return { startTime: 0, duration: 0 };
    }

    const allTimes = result.data.flatMap((span) => [
      new Date(span.startTime).getTime(),
      new Date(span.endTime).getTime(),
    ]);

    const startTime = Math.min(...allTimes);
    const endTime = Math.max(...allTimes);

    return {
      startTime,
      duration: endTime - startTime,
    };
  }, [result.data, result.isSuccess]);

  const rowVirtualizer = useVirtualizer({
    count: processedSpans.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 45,
  });

  const toggleExpand = (spanId: string) => {
    setExpandedSpans((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(spanId)) {
        newSet.delete(spanId);
      } else {
        newSet.add(spanId);
      }
      return newSet;
    });
  };

  const selectSpan = (span: SpanNodeExtended) => {
    setSelectedSpan(span);
  };

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
          return response.data;
        }
        return currentLevel === 1
          ? [
              {
                ...currentSpan,
                currentChildrenCount: currentSpan.currentChildrenCount + newlyAddedChildren,
              },
              ...oldData.slice(index + 1),
              ...response.data,
            ]
          : [
              ...oldData.slice(0, index),
              {
                ...currentSpan,
                currentChildrenCount: currentSpan.currentChildrenCount + newlyAddedChildren,
              },
              ...oldData.slice(index + 1, nextSpanWithSameLevel),
              ...response.data,
              ...oldData.slice(index + currentSpan.currentChildrenCount + 1),
            ];
      });
    });
  };

  return (
    <PluginPage>
      <div data-testid={testIds.pageThree.container} className={styles.container}>
        <div className={styles.header}>
          <h2>Trace Detail: {rootSpanId}</h2>
          {result.isSuccess && (
            <div className={styles.traceStats}>
              <span>Total Spans: {result.data.length}</span>
              <span>Duration: {formatDuration(traceTimingInfo.duration)}</span>
            </div>
          )}
        </div>

        {result.isLoading && <div>Loading...</div>}
        {result.isError && <div>Error: {result.error.message}</div>}

        {result.isSuccess && (
          <div className={styles.traceViewer}>
            <div className={`${styles.traceContainer} ${selectedSpan}`}>
              <TimelineHeader traceDuration={traceTimingInfo.duration} traceStartTime={traceTimingInfo.startTime} />

              <div ref={parentRef} className={styles.spanList}>
                <div
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                    const span = processedSpans[virtualItem.index];
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
                        <Span
                          {...span}
                          index={virtualItem.index}
                          traceStartTime={traceTimingInfo.startTime}
                          traceDuration={traceTimingInfo.duration}
                          onToggleExpand={toggleExpand}
                          onSelectSpan={selectSpan}
                          selectedSpanId={selectedSpan?.spanId}
                          loadMore={loadMore}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <SpanDetailSidebar span={selectedSpan} onClose={() => setSelectedSpan(null)} />
          </div>
        )}
      </div>
    </PluginPage>
  );
}

export default TraceDetail;

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    height: 100vh;
    display: flex;
    flex-direction: column;
  `,
  header: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: ${theme.spacing(2)};
    border-bottom: 1px solid ${theme.colors.border.weak};
    background: ${theme.colors.background.primary};
  `,
  traceStats: css`
    display: flex;
    gap: ${theme.spacing(2)};
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.size.sm};

    span {
      padding: ${theme.spacing(0.5)} ${theme.spacing(1)};
      background: ${theme.colors.background.secondary};
      border-radius: ${theme.shape.borderRadius()};
    }
  `,
  traceViewer: css`
    flex: 1;
    display: flex;
    min-height: 0;
  `,
  traceContainer: css`
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    transition: all 0.3s ease;

    &.withSidebar {
      width: 70%;
    }
  `,
  timelineHeader: css`
    border-bottom: 1px solid ${theme.colors.border.weak};
    background: ${theme.colors.background.secondary};
    position: sticky;
    top: 0;
    z-index: 10;
  `,
  timelineLabels: css`
    display: flex;
    height: 40px;
    align-items: end;
    padding-bottom: ${theme.spacing(1)};
  `,
  spanColumn: css`
    width: 350px;
    min-width: 350px;
    padding: 0 ${theme.spacing(1)};
    font-weight: 500;
    border-right: 1px solid ${theme.colors.border.weak};
  `,
  timelineColumn: css`
    flex: 1;
    position: relative;
    margin: 0 ${theme.spacing(1)};
  `,
  serviceColumn: css`
    width: 120px;
    min-width: 120px;
    padding: 0 ${theme.spacing(1)};
    font-weight: 500;
  `,
  timeMarker: css`
    position: absolute;
    font-size: ${theme.typography.size.xs};
    color: ${theme.colors.text.secondary};
    transform: translateX(-50%);
    white-space: nowrap;
  `,
  spanList: css`
    flex: 1;
    overflow: auto;
    background: ${theme.colors.background.primary};
  `,
  spanRow: css`
    display: flex;
    align-items: center;
    min-height: 45px;
    border-bottom: 1px solid ${theme.colors.border.weak};
    cursor: pointer;
    position: relative;

    &:hover {
      background: ${theme.colors.background.secondary};
    }
  `,
  spanRowSelected: css`
    background: ${theme.colors.primary.transparent};
    border-left: 3px solid ${theme.colors.primary.main};
  `,
  spanInfo: css`
    display: flex;
    align-items: center;
    gap: ${theme.spacing(1)};
    padding: ${theme.spacing(0.5)};
    width: 100%;
  `,
  expandButton: css`
    background: none;
    border: none;
    cursor: pointer;
    padding: ${theme.spacing(0.25)};
    display: flex;
    align-items: center;
    color: ${theme.colors.text.primary};

    &:hover {
      background: ${theme.colors.background.secondary};
      border-radius: ${theme.shape.borderRadius()};
    }
  `,
  expandSpacer: css`
    width: 24px;
    height: 24px;
  `,
  spanName: css`
    font-weight: 500;
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,
  spanDuration: css`
    font-size: ${theme.typography.size.sm};
    color: ${theme.colors.text.secondary};
    min-width: 60px;
    text-align: right;
  `,
  spanBarContainer: css`
    height: 20px;
    width: 100%;
    position: relative;
    background: ${theme.colors.background.secondary};
    border-radius: 2px;
  `,
  spanBar: css`
    position: absolute;
    height: 100%;
    border-radius: 2px;
    min-width: 2px;
    transition: opacity 0.2s ease;

    &:hover {
      opacity: 0.8;
    }
  `,
  serviceTag: css`
    display: inline-block;
    padding: ${theme.spacing(0.25)} ${theme.spacing(0.75)};
    border-radius: ${theme.shape.borderRadius()};
    font-size: ${theme.typography.size.xs};
    color: white;
    font-weight: 500;
    max-width: 100px;
    white-space: nowrap;
    overflow: hidden;
    min-height: 20px;
  `,
  loadMoreIndicator: css`
    font-size: ${theme.typography.size.xs};
    color: ${theme.colors.text.secondary};
    background: ${theme.colors.background.secondary};
    border-radius: ${theme.shape.borderRadius()};
  `,
  sidebar: css`
    width: 30%;
    min-width: 300px;
    border-left: 1px solid ${theme.colors.border.weak};
    background: ${theme.colors.background.primary};
    display: flex;
    flex-direction: column;
  `,
  sidebarHeader: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: ${theme.spacing(2)};
    border-bottom: 1px solid ${theme.colors.border.weak};
    background: ${theme.colors.background.secondary};

    h3 {
      margin: 0;
      font-size: ${theme.typography.size.lg};
    }
  `,
  closeButton: css`
    background: none;
    border: none;
    cursor: pointer;
    padding: ${theme.spacing(0.5)};
    color: ${theme.colors.text.primary};

    &:hover {
      background: ${theme.colors.background.primary};
      border-radius: ${theme.shape.borderRadius()};
    }
  `,
  sidebarContent: css`
    flex: 1;
    overflow: auto;
    padding: ${theme.spacing(2)};
  `,
  sidebarSection: css`
    margin-bottom: ${theme.spacing(3)};

    h4 {
      margin: 0 0 ${theme.spacing(1)} 0;
      font-size: ${theme.typography.size.md};
      color: ${theme.colors.text.primary};
    }
  `,
  attributeList: css`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(1)};
  `,
  attribute: css`
    padding: ${theme.spacing(1)};
    background: ${theme.colors.background.secondary};
    border-radius: ${theme.shape.borderRadius()};
    font-size: ${theme.typography.size.sm};

    strong {
      color: ${theme.colors.text.primary};
      margin-right: ${theme.spacing(1)};
    }
  `,
  eventList: css`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(1)};
  `,
  event: css`
    padding: ${theme.spacing(1)};
    background: ${theme.colors.background.secondary};
    border-radius: ${theme.shape.borderRadius()};
    border-left: 3px solid ${theme.colors.info.main};
  `,
  eventTime: css`
    font-size: ${theme.typography.size.xs};
    color: ${theme.colors.text.secondary};
    margin-bottom: ${theme.spacing(0.5)};
  `,
  eventName: css`
    font-weight: 500;
    font-size: ${theme.typography.size.sm};
    margin-bottom: ${theme.spacing(0.5)};
  `,
  eventAttributes: css`
    font-size: ${theme.typography.size.xs};
    color: ${theme.colors.text.secondary};
  `,
  eventAttribute: css`
    margin-bottom: ${theme.spacing(0.25)};
  `,
});
