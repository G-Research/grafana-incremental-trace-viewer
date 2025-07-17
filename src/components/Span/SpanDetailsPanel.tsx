import React from 'react';
import clsx from 'clsx';

import type { SpanInfo } from '../TraceDetail';
import { mkUnixEpochFromNanoSeconds, formatUnixNanoToDateTime, formatDuration } from 'utils/utils.timeline';
import { useQuery } from '@tanstack/react-query';
import { flattenObject, searchTags, search } from 'utils/utils.api';

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
      if (data?.traces?.[0]?.spanSets?.[0]?.spans?.[0]?.attributes) {
        return data.traces[0].spanSets[0].spans[0].attributes;
      }

      return {};
    },
  });

  const formatValue = (value: any, typeOverride?: string) => {
    const type = typeOverride || typeof value;
    switch (type) {
      case 'string':
        return <span className="px-2 py-2 text-cyan-400">&quot;{value}&quot;</span>;
      case 'number':
        return <span className="px-2 py-2 text-blue-500">{value}</span>;
      case 'boolean':
        return <span className="px-2 py-2 text-green-600">{value.toString()}</span>;
      case 'object':
        return <span className="px-2 py-2 text-gray-200 italic">{JSON.stringify(value)}</span>;
      default:
        return <span className="px-2 py-2 text-gray-200 italic">{JSON.stringify(value)}</span>;
    }
  };

  const basicSpanData = [
    { key: 'Name', value: span.name },
    { key: 'ID', value: span.spanId },
    { key: 'Trace ID', value: span.traceId },
    { key: 'Start Time', value: formatUnixNanoToDateTime(span.startTimeUnixNano) },
    { key: 'End Time', value: formatUnixNanoToDateTime(span.endTimeUnixNano) },
    { key: 'Duration', value: formatDuration(span.endTimeUnixNano - span.startTimeUnixNano), type: 'number' },
  ];

  const rowClassName = (index: number) => {
    return clsx('leading-7', index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-700');
  };

  const flattenedAttributes = result.data ? flattenObject(result.data) : {};

  return (
    <div className="z-10">
      <div className="overflow-hidden text-sm">
        <table className="w-full">
          <tbody>
            {basicSpanData.map((item, index) => (
              <tr key={item.key} className={rowClassName(index)}>
                <td className="font-semibold text-gray-300 border-r border-gray-600 w-1/3 mx-4">
                  <span className="px-2 py-2">{item.key}</span>{' '}
                  {/* TODO: padding & margins are overriden to 0 by the global CSS and it is not possible to set it on the td tag */}
                </td>
                <td>{formatValue(item.value, item.type)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {Object.keys(flattenedAttributes).length > 0 && (
          <>
            <div className="mt-4 mb-2 text-sm font-semibold text-gray-300">Additional Span Data</div>
            <table className="w-full">
              <tbody>
                {Object.entries(flattenedAttributes).map(([key, value], index) => (
                  <tr
                    key={key}
                    className={rowClassName(basicSpanData.length + Object.keys(flattenedAttributes).length + index)}
                  >
                    <td className="font-semibold text-gray-300 border-r border-gray-600 w-1/3">
                      <span className="px-2 py-2">{key}</span>
                    </td>
                    <td>{formatValue(value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
};
