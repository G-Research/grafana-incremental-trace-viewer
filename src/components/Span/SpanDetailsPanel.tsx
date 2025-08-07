import React, { useState } from 'react';
import clsx from 'clsx';

import type { SpanInfo } from '../../types';
import { mkUnixEpochFromNanoSeconds, formatUnixNanoToDateTime, formatDuration } from 'utils/utils.timeline';
import { useQuery } from '@tanstack/react-query';
import { searchTags, search, KeyValue, AnyValue } from 'utils/utils.api';
import { Accordion } from './Accordion';

async function getTagAttributes(
  datasourceUid: string,
  start: number,
  end: number,
  traceId: string,
  spanId: string,
  tags: string[]
) {
  // There could potentially be a lot of tags, so we need to split them into groups to avoid the query being too long.
  const groups: string[][] = [];
  let currentGroup: string[] = [];
  let currentLength = 0;
  let maxLength = 1000;
  for (const tag of tags) {
    if (currentLength + tag.length < maxLength) {
      currentGroup.push(tag);
      currentLength += tag.length;
    } else {
      groups.push(currentGroup);
      currentGroup = [tag];
      currentLength = tag.length;
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  const promises = groups.map(async (group) => {
    const q = `{ trace:id = "${traceId}" && span:id = "${spanId}" } | select (${group
      .map((t) => `span.${t}`)
      .join(', ')})`;
    const data = await search(datasourceUid, q, start, end, 1);
    return data.traces?.[0].spanSets?.[0].spans?.[0].attributes || [];
  });

  const results: KeyValue[][] = await Promise.all(promises);
  const combined: Record<string, AnyValue> = {};
  for (const result of results) {
    for (const keyValue of result) {
      if (keyValue.key) {
        combined[keyValue.key] = keyValue.value !== undefined ? keyValue.value : { stringValue: '???' };
      }
    }
  }

  return combined;
}

function splitAttributesAndEvents(allAttributes: Record<string, AnyValue>) {
  const attributes: Record<string, AnyValue> = {};
  const events = [];
  const process = [];
  for (const [key, value] of Object.entries(allAttributes)) {
    if (key.startsWith('event.') && value.stringValue !== undefined) {
      events.push({ time: parseInt(key.replace('event.', ''), 10), value: value.stringValue });
    } else if (key.startsWith('k8s.')) {
      process.push({ name: key.replace('k8s.', ''), value: value.stringValue });
    } else {
      attributes[key] = value;
    }
  }
  return { attributes, events, process };
}

export const SpanDetailPanel = ({
  span,
  onClose,
  datasourceUid,
}: {
  span: SpanInfo;
  onClose: () => void;
  datasourceUid: string;
}) => {
  const [expandedSections, setExpandedSections] = useState({
    additionalData: false,
    events: false,
    process: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const result = useQuery<Record<string, any>>({
    queryKey: ['trace', span.traceId, 'span', span.spanId, 'details'],
    queryFn: async () => {
      const qTags = `{ trace:id = "${span.traceId}" && span:id = "${span.spanId}" }`;
      const start = mkUnixEpochFromNanoSeconds(span.startTimeUnixNano);
      const end = mkUnixEpochFromNanoSeconds(span.endTimeUnixNano);
      const tags = await searchTags(datasourceUid, qTags, start, end);
      return getTagAttributes(datasourceUid, start, end, span.traceId, span.spanId, tags);
    },
  });

  const formatValue = (value: AnyValue) => {
    if (value.stringValue !== undefined) {
      return <span className="px-2 py-2 text-cyan-400">&quot;{value.stringValue}&quot;</span>;
    } else if (value.boolValue !== undefined) {
      return <span className="px-2 py-2 text-blue-500">{value.boolValue ? 'true' : 'false'}</span>;
    } else if (value.intValue !== undefined) {
      return <span className="px-2 py-2 text-green-600">{value.intValue}</span>;
    } else if (value.doubleValue !== undefined) {
      return <span className="px-2 py-2 text-green-600">{value.doubleValue}</span>;
    } else if (value.bytesValue !== undefined) {
      return <span className="px-2 py-2 text-gray-200 italic">{JSON.stringify(value)}</span>;
    }
    return <span className="px-2 py-2 text-gray-200 italic">{JSON.stringify(value)}</span>;
  };

  const basicSpanData: KeyValue[] = [
    { key: 'Name', value: { stringValue: span.name } },
    { key: 'ID', value: { stringValue: span.spanId } },
    { key: 'Trace ID', value: { stringValue: span.traceId } },
    { key: 'Start Time', value: { stringValue: formatUnixNanoToDateTime(span.startTimeUnixNano) } },
    { key: 'End Time', value: { stringValue: formatUnixNanoToDateTime(span.endTimeUnixNano) } },
    { key: 'Duration', value: { stringValue: formatDuration(span.endTimeUnixNano - span.startTimeUnixNano) } },
  ];

  const rowClassName = (index: number) => {
    return clsx('leading-7', index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-700');
  };

  const { attributes, events, process } = result.isSuccess
    ? splitAttributesAndEvents(result.data)
    : { attributes: {}, events: [], process: [] };

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
                <td>{item.value && formatValue(item.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {Object.keys(attributes).length > 0 && (
          <Accordion
            title="Additional Span Data"
            isExpanded={expandedSections.additionalData}
            onToggle={() => toggleSection('additionalData')}
          >
            <table className="w-full">
              <tbody>
                {Object.entries(attributes).map(([key, value], index) => (
                  <tr key={key} className={rowClassName(basicSpanData.length + Object.keys(attributes).length + index)}>
                    <td className="font-semibold text-gray-300 border-r border-gray-600 w-1/3">
                      <span className="px-2 py-2">{key}</span>
                    </td>
                    <td>{formatValue(value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Accordion>
        )}

        {/* Process Section */}
        <Accordion title="Process" isExpanded={expandedSections.process} onToggle={() => toggleSection('process')}>
          <table className="w-full">
            <tbody>
              {process.map((item, index) => (
                <tr key={item.name} className={rowClassName(index)}>
                  <td className="font-semibold text-gray-300 border-r border-gray-600 w-1/3">
                    <span className="px-2 py-2">{item.name}</span>
                  </td>
                  <td>{item.value && formatValue({ stringValue: item.value })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Accordion>

        {/* Events Section */}
        {events.length > 0 && (
          <Accordion title="Events" isExpanded={expandedSections.events} onToggle={() => toggleSection('events')}>
            <table className="w-full">
              <tbody>
                {events.map((item, index) => (
                  <tr key={item.time} className={rowClassName(index)}>
                    <td className="font-semibold text-gray-300 border-r border-gray-600 w-1/3">
                      <span className="px-2 py-2">
                        {/* print the time in seconds since the start of the span with 3 decimal places */}
                        {((item.time - span.startTimeUnixNano / 1000000) / 1000).toFixed(3)}s
                      </span>
                    </td>
                    <td>{item.value && formatValue({ stringValue: item.value })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Accordion>
        )}
      </div>
    </div>
  );
};
