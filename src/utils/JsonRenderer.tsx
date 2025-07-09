import React, { useState } from 'react';

interface JsonRendererProps {
  data: any;
  title?: string;
  level?: number;
  maxDepth?: number;
}

interface JsonValueProps {
  value: any;
  key?: string;
  level: number;
  maxDepth: number;
}

const JsonValue: React.FC<JsonValueProps> = ({ value, key, level, maxDepth }) => {
  const [isExpanded, setIsExpanded] = useState(level < 2); // Auto-expand first 2 levels

  if (value === null) {
    return <span className="text-gray-500 italic">null</span>;
  }

  if (value === undefined) {
    return <span className="text-gray-500 italic">undefined</span>;
  }

  if (typeof value === 'boolean') {
    return <span className="text-blue-600">{value.toString()}</span>;
  }

  if (typeof value === 'number') {
    return <span className="text-green-600">{value}</span>;
  }

  if (typeof value === 'string') {
    return <span className="text-orange-600">&quot;{value}&quot;</span>;
  }

  if (Array.isArray(value)) {
    if (level >= maxDepth) {
      return <span className="text-gray-500 italic">[...] ({value.length} items)</span>;
    }

    return (
      <div className="ml-4">
        <div
          className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1 rounded"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className="text-gray-400 text-sm">{isExpanded ? '▼' : '▶'}</span>
          <span className="text-purple-600 font-medium">Array ({value.length} items)</span>
        </div>
        {isExpanded && (
          <div className="ml-4 mt-1">
            {value.map((item, index) => (
              <div key={index} className="mb-1">
                <span className="text-gray-500 text-sm">[{index}]: </span>
                <JsonValue value={item} level={level + 1} maxDepth={maxDepth} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (typeof value === 'object') {
    if (level >= maxDepth) {
      const keyCount = Object.keys(value).length;
      return (
        <span className="text-gray-500 italic">
          {'{...}'} ({keyCount} properties)
        </span>
      );
    }

    const keys = Object.keys(value);

    return (
      <div className="ml-4">
        <div
          className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1 rounded"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className="text-gray-400 text-sm">{isExpanded ? '▼' : '▶'}</span>
          <span className="text-blue-600 font-medium">Object ({keys.length} properties)</span>
        </div>
        {isExpanded && (
          <div className="ml-4 mt-1">
            {keys.map((k) => (
              <div key={k} className="mb-2">
                <div className="flex items-start gap-2">
                  <span className="text-gray-700 font-medium min-w-0 flex-shrink-0">{k}:</span>
                  <div className="flex-1 min-w-0">
                    <JsonValue value={value[k]} key={k} level={level + 1} maxDepth={maxDepth} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return <span className="text-gray-600">{String(value)}</span>;
};

export const JsonRenderer: React.FC<JsonRendererProps> = ({ data, title, level = 0, maxDepth = 5 }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      {title && <h3 className="text-lg font-semibold text-gray-800 mb-3">{title}</h3>}
      <div className="font-mono text-sm">
        <JsonValue value={data} level={level} maxDepth={maxDepth} />
      </div>
    </div>
  );
};
