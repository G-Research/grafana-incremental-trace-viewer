import React, { useCallback, MouseEvent } from 'react';
import { Icon } from '@grafana/ui';
import { formatDuration, getColourForValue, mkMilisecondsFromNanoSeconds } from '../../utils/utils.timeline';
import { SpanInfo, ChildStatus } from '../../types';

type SpanNodeProps = SpanInfo & {
  updateChildStatus: (span: SpanInfo) => void;
  traceStartTimeInMiliseconds: number;
  traceDurationInMiliseconds: number;
  onSelect: (span: SpanInfo) => void;
  isSelected?: boolean;
  leftColumnPercent: number;
  // This is the offset on the right side of the timeline.
  // It is used to shrink the timeline to make room for the top-level span duration.
  timelineOffset: number;
};

const Expand = ({ childStatus, action }: { childStatus: ChildStatus; action: () => void }) => {
  let mouseDown = useCallback(
    (ev: MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
      action();
    },
    [action]
  );
  switch (childStatus) {
    case ChildStatus.RemoteChildren:
    case ChildStatus.HideChildren:
      return <Icon name="angle-right" onMouseDown={mouseDown} />;
    case ChildStatus.ShowChildren:
      return <Icon name="angle-down" onMouseDown={mouseDown} />;
    case ChildStatus.NoChildren:
      return null;
    case ChildStatus.LoadingChildren:
      return <Icon name="spinner" className="animate-spin" />;
  }
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

  // We don't show the root timing
  const formattedDuration = formatDuration(props.endTimeUnixNano - props.startTimeUnixNano);
  const timing = (
    <div
      className="absolute top-0 h-full flex items-center whitespace-nowrap"
      // We want to display the duration on the right side of the span.
      // We add 1% to the width for some padding.
      style={{ left: `${width + offset + 1}%` }}
    >
      <span className="m-auto leading-none text-gray-500 font-xs font-mono">{formattedDuration}</span>
    </div>
  );

  return (
    <div
      className={`flex items-center dark:hover:bg-gray-700 hover:bg-zinc-100 cursor-pointer h-full text-sm ${
        props.isSelected ? 'dark:bg-gray-600 bg-blue-200 z-1000' : ''
      }`}
    >
      <div
        className="flex items-center justify-between gap-1 pr-2"
        style={{
          paddingLeft: `calc(2rem * ${props.level})`,
          width: `${props.leftColumnPercent}%`,
          minWidth: 0,
        }} // Limitation in tailwind dynamic class construction: Check README.md for more details
      >
        <div className="flex items-center gap-1 truncate">
          <Expand childStatus={props.childStatus} action={() => props.updateChildStatus(props)}></Expand>
          {props.childCount !== undefined && props.childCount > 0 && (
            <strong
              style={{ backgroundColor: getColourForValue(props.serviceNamespace || 'default') }}
              className="block p-[3px] min-w-5 mr-1 rounded font-mono font-thin leading-none text-black text-center"
            >
              {props.childCount}
            </strong>
          )}
          <span>{props.name}</span>
        </div>
      </div>
      <div
        className="h-full relative border-l-3"
        // We leave a bit or room for the duration text of the top-level span.
        style={{ width: `calc(${100 - props.leftColumnPercent}% - ${props.timelineOffset}px)` }}
        onClick={() => props.onSelect(props)}
      >
        <div className="h-full relative mx-1">
          <div
            className="h-3/4 absolute my-auto top-0 bottom-0 rounded-sm min-w-[2px]"
            style={{
              left: `${offset}%`,
              width: `${Math.max(width, 0.1)}%`,
              backgroundColor: getColourForValue(props.serviceNamespace || 'default'),
            }} // Limitation in tailwind dynamic class construction: Check README.md for more details
            title={`Duration: ${props.endTimeUnixNano - props.startTimeUnixNano}ns`}
          ></div>
          {timing}
        </div>
      </div>
    </div>
  );
};
