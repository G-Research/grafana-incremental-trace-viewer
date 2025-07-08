import React from 'react';
import { Icon } from '@grafana/ui';
import { calculateColourBySpanId, mkMilisecondsFromNanoSeconds } from '../../utils/utils.timeline';
import type { Span as SpanType } from '../../pages/TraceDetail';

type SpanNodeProps = SpanType & {
  index: number;
  loadMore: (index: number, spanId: string, currentLevel: number) => void;
  collapse: (spanId: string) => void;
  isExpanded: boolean;
  hasChildren: boolean;
  traceStartTimeInMiliseconds: number;
  traceDurationInMiliseconds: number;
  onSelect: (span: SpanType) => void;
};

export const Span = (props: SpanNodeProps) => {
  const offset =
    ((mkMilisecondsFromNanoSeconds(props.startTimeUnixNano) - props.traceStartTimeInMiliseconds) /
      props.traceDurationInMiliseconds) *
    100;
  const width =
    ((mkMilisecondsFromNanoSeconds(props.endTimeUnixNano) - mkMilisecondsFromNanoSeconds(props.startTimeUnixNano)) /
      props.traceDurationInMiliseconds) *
    100;

  const canLoadMore = props.hasMore;

  return (
    <div
      className="flex items-center hover:bg-gray-700 cursor-pointer h-full text-sm"
      onClick={() => props.onSelect(props)}
    >
      <div
        className="w-1/3 flex items-center justify-between gap-1 pr-2"
        style={{ paddingLeft: `calc(0.5rem * ${props.level})` }} // Limitation in tailwind dynamic class construction: Check README.md for more details
      >
        <div className="flex items-center gap-1 truncate">
          {(canLoadMore || props.hasChildren) && (
            <Icon
              name={props.isExpanded ? 'angle-down' : 'angle-right'}
              className="text-xs cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                if (props.isExpanded) {
                  props.collapse(props.spanId);
                } else {
                  props.loadMore(props.index, props.spanId, props.level);
                }
              }}
            />
          )}
          {!props.hasChildren && <span className="inline-block w-4"></span>}
          <span>{props.name}</span>
        </div>
        <div className="flex items-center gap-1">
          {canLoadMore && !props.isExpanded && (
            <Icon
              name="plus"
              className="text-xs cursor-pointer"
              title="Load more traces"
              onClick={(e) => {
                e.stopPropagation();
                props.loadMore(props.index, props.spanId, props.level);
              }}
            />
          )}
          {props.isExpanded && (
            <Icon
              name="minus"
              className="text-xs cursor-pointer"
              title="Collapse"
              onClick={(e) => {
                e.stopPropagation();
                props.collapse(props.spanId);
              }}
            />
          )}
        </div>
      </div>
      <div
        className="w-2/3 h-full relative border-l-3"
        data-testid={props.parentSpanId}
        style={{ borderColor: calculateColourBySpanId(props.parentSpanId || props.spanId) }} // Limitation in tailwind dynamic class construction: Check README.md for more details
      >
        <div className="h-full relative mx-4">
          <div
            className="bg-blue-500 h-3/4 absolute my-auto top-0 bottom-0 rounded-sm min-[2px]"
            style={{ left: `${offset}%`, width: `${Math.max(width, 0.1)}%` }} // Limitation in tailwind dynamic class construction: Check README.md for more details
            title={`Duration: ${props.endTimeUnixNano - props.startTimeUnixNano}ns`}
          ></div>
        </div>
      </div>
    </div>
  );
};
