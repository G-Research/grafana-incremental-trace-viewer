import React, { useState } from 'react';
import clsx from 'clsx';

import type { SpanInfo } from '../../types';
import { mkUnixEpochFromNanoSeconds, formatUnixNanoToDateTime, formatDuration } from 'utils/utils.timeline';
import { useQuery } from '@tanstack/react-query';
import { searchTags, search, KeyValue, AnyValue } from 'utils/utils.api';

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

  // Dummy data for Events section
  const eventsData: KeyValue[] = [
    { key: 'Event Count', value: { intValue: 3 } },
    { key: 'Event Type', value: { stringValue: 'log' } },
    { key: 'Event Name', value: { stringValue: 'user.login' } },
    { key: 'Event Timestamp', value: { stringValue: formatUnixNanoToDateTime(span.startTimeUnixNano + 1000000) } },
    { key: 'Event Attributes', value: { stringValue: '{"user_id": "12345", "ip": "192.168.1.1"}' } },
  ];

  // Dummy data for Process section
  const processData: KeyValue[] = [
    { key: 'Process ID', value: { intValue: 1234 } },
    { key: 'Process Name', value: { stringValue: 'web-server' } },
    { key: 'Service Name', value: { stringValue: 'auth-service' } },
    { key: 'Service Version', value: { stringValue: '1.2.3' } },
    { key: 'Host Name', value: { stringValue: 'server-01' } },
    { key: 'Environment', value: { stringValue: 'production' } },
  ];

  const rowClassName = (index: number) => {
    return clsx('leading-7', index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-700');
  };

  const flattenedAttributes = result.isSuccess ? result.data : {};

  const AccordionSection = ({
    title,
    isExpanded,
    onToggle,
    children,
  }: {
    title: string;
    isExpanded: boolean;
    onToggle: () => void;
    children: React.ReactNode;
  }) => (
    <div className="border-t border-gray-600 pt-4">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-sm font-semibold text-gray-300 hover:text-gray-100 transition-colors duration-200 mb-2"
      >
        <span>{title}</span>
        <svg
          className={clsx('w-4 h-4 transition-transform duration-200', isExpanded ? 'rotate-180' : 'rotate-0')}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div
        className={clsx(
          'overflow-hidden transition-all duration-300 ease-in-out',
          isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        {children}
      </div>
    </div>
  );

  return (
    <div className="z-10">
      <div className="overflow-hidden text-sm">
        {/* Basic Span Data Section */}
        <div className="mb-4">
          <div className="text-sm font-semibold text-gray-300 mb-2">Span Details</div>
          <table className="w-full">
            <tbody>
              {basicSpanData.map((item, index) => (
                <tr key={item.key} className={rowClassName(index)}>
                  <td className="font-semibold text-gray-300 border-r border-gray-600 w-1/3 mx-4">
                    <span className="px-2 py-2">{item.key}</span>
                  </td>
                  <td>{item.value && formatValue(item.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Additional Span Data Section */}
        {Object.keys(flattenedAttributes).length > 0 && (
          <AccordionSection
            title="Additional Span Data"
            isExpanded={expandedSections.additionalData}
            onToggle={() => toggleSection('additionalData')}
          >
            <table className="w-full">
              <tbody>
                {Object.entries(flattenedAttributes).map(([key, value], index) => (
                  <tr key={key} className={rowClassName(index)}>
                    <td className="font-semibold text-gray-300 border-r border-gray-600 w-1/3">
                      <span className="px-2 py-2">{key}</span>
                    </td>
                    <td>{formatValue(value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AccordionSection>
        )}

        {/* Events Section */}
        <AccordionSection title="Events" isExpanded={expandedSections.events} onToggle={() => toggleSection('events')}>
          <table className="w-full">
            <tbody>
              {eventsData.map((item, index) => (
                <tr key={item.key} className={rowClassName(index)}>
                  <td className="font-semibold text-gray-300 border-r border-gray-600 w-1/3">
                    <span className="px-2 py-2">{item.key}</span>
                  </td>
                  <td>{item.value && formatValue(item.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AccordionSection>

        {/* Process Section */}
        <AccordionSection
          title="Process"
          isExpanded={expandedSections.process}
          onToggle={() => toggleSection('process')}
        >
          <table className="w-full">
            <tbody>
              {processData.map((item, index) => (
                <tr key={item.key} className={rowClassName(index)}>
                  <td className="font-semibold text-gray-300 border-r border-gray-600 w-1/3">
                    <span className="px-2 py-2">{item.key}</span>
                  </td>
                  <td>{item.value && formatValue(item.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AccordionSection>
      </div>
    </div>
  );
};
