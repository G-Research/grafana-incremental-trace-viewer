import React from 'react';

import type { SpanInfo } from '../TraceDetail';
import { mkUnixEpochFromNanoSeconds, formatUnixNanoToDateTime } from 'utils/utils.timeline';
import { useQuery } from '@tanstack/react-query';
import { searchTags, search } from 'utils/utils.api';
import { JsonRenderer } from 'utils/JsonRenderer';

export const SpanDetailPanel = ({
  span,
  onClose,
  datasourceUid,
}: {
  span: SpanInfo;
  onClose: () => void;
  datasourceUid: string;
}) => {
  const result = useQuery<Record<string, any>>({
    queryKey: ['trace', span.traceId, 'span', span.spanId, 'details'],
    queryFn: async () => {
      const qTags = `{ trace:id = "${span.traceId}" && span:id = "${span.spanId}" }`;
      const start = mkUnixEpochFromNanoSeconds(span.startTimeUnixNano);
      const end = mkUnixEpochFromNanoSeconds(span.endTimeUnixNano);
      const tags = await searchTags(datasourceUid, qTags, start, end);
      console.log('TAGS', tags);
      const q = `{ trace:id = "${span.traceId}" && span:id = "${span.spanId}" } | select (${tags
        .map((t) => `span.${t}`)
        .join(', ')})`;
      const data = await search(datasourceUid, q, start, end, 1);
      if (data.traces?.[0]?.spanSets?.[0]?.spans?.[0]) {
        return data.traces[0].spanSets[0].spans[0].attributes;
      }

      return {};
    },
  });

  const formattedOutput = (value: any) => {
    const codeBlockStyle = 'block w-full p-2 border border-gray-600 rounded font-mono text-sm overflow-x-auto';

    switch (typeof value) {
      case 'string':
        return <div className={`${codeBlockStyle} text-orange-200`}>{value}</div>;
      case 'number':
        return <div className={`${codeBlockStyle} text-green-600`}>{value}</div>;
      case 'boolean':
        return <div className={`${codeBlockStyle} text-blue-600`}>{value.toString()}</div>;
      case 'object':
        return <div className={`${codeBlockStyle} text-gray-200 italic`}>{JSON.stringify(value)}</div>;
      default:
        return <div className={`${codeBlockStyle} text-gray-200 italic`}>{JSON.stringify(value)}</div>;
    }
  };

  return (
    <div className="p-4 z-10">
      <div className="flex flex-col gap-2">
        <div>
          <strong>Name:</strong> {formattedOutput(span.name)}
        </div>
        <div>
          <strong>ID:</strong> {formattedOutput(span.spanId)}
        </div>
        <div>
          <strong>Trace ID:</strong>
          {formattedOutput(span.traceId)}
        </div>
        <div>
          <strong>Start Time:</strong> {formattedOutput(formatUnixNanoToDateTime(span.startTimeUnixNano))}
        </div>
        <div>
          <strong>End Time:</strong> {formattedOutput(formatUnixNanoToDateTime(span.endTimeUnixNano))}
        </div>
        <div>
          <strong>Duration (nanoseconds):</strong> {formattedOutput(span.endTimeUnixNano - span.startTimeUnixNano)}
        </div>
        {result.data && Object.keys(result.data).length > 0 && (
          <>
            <div className="mt-4">
              <JsonRenderer data={result.data} title="Span Attributes" maxDepth={3} />
            </div>
            <div className="mt-4">
              <strong>Raw JSON:</strong>
              <pre>{JSON.stringify(result.data)}</pre> {/* TODO: This is for debugging only. Remove later. */}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
