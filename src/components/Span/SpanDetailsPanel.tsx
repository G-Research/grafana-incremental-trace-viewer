import React from 'react';
import clsx from 'clsx';

import type { SpanInfo } from '../TraceDetail';
import { mkUnixEpochFromNanoSeconds, formatUnixNanoToDateTime, formatDuration } from 'utils/utils.timeline';
import { useQuery } from '@tanstack/react-query';
import { searchTags, search } from 'utils/utils.api';

const flattenObject = (obj: any, prefix = ''): Record<string, any> => {
  const flattened: Record<string, any> = {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (Array.isArray(obj[key])) {
        // Handle arrays with bracket notation
        obj[key].forEach((item: any, index: number) => {
          const arrayKey = prefix ? `${prefix}[${index}]` : `[${index}]`;
          if (typeof item === 'object' && item !== null) {
            Object.assign(flattened, flattenObject(item, arrayKey));
          } else {
            flattened[arrayKey] = item;
          }
        });
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        Object.assign(flattened, flattenObject(obj[key], newKey));
      } else {
        flattened[newKey] = obj[key];
      }
    }
  }

  return flattened;
};

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

  const formatValue = (value: any): string => {
    switch (typeof value) {
      case 'string':
        return value;
      case 'number':
        return value.toString();
      case 'boolean':
        return value.toString();
      case 'object':
        return JSON.stringify(value);
      default:
        return JSON.stringify(value);
    }
  };

  const basicSpanData = [
    { key: 'Name', value: span.name },
    { key: 'ID', value: span.spanId },
    { key: 'Trace ID', value: span.traceId },
    { key: 'Start Time', value: formatUnixNanoToDateTime(span.startTimeUnixNano) },
    { key: 'End Time', value: formatUnixNanoToDateTime(span.endTimeUnixNano) },
    { key: 'Duration', value: formatDuration(span.endTimeUnixNano - span.startTimeUnixNano) },
  ];

  const rowClassName = (index: number) => {
    return clsx('leading-7', index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-700');
  };

  const flattenedAttributes = result.data ? flattenObject(result.data) : {};

  return (
    <div className="z-10">
      <div className="overflow-hidden font-thin text-sm">
        <table className="w-full">
          <tbody>
            {basicSpanData.map((item, index) => (
              <tr key={item.key} className={rowClassName(index)}>
                <td className="font-semibold text-gray-300 border-r border-gray-600 w-1/3 mx-4">
                  <span className="px-2 py-2">{item.key}</span>{' '}
                  {/* TODO: padding & margins are overriden to 0 by the global CSS and it is not possible to set it on the td tag */}
                </td>
                <td>
                  <span className="px-2 py-2">{formatValue(item.value)}</span>
                </td>
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
                    <td>
                      <span className="px-2 py-2">{formatValue(value)}</span>
                    </td>
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
