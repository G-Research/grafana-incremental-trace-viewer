import React from 'react';

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
  const codeBlockStyle = 'block w-full p-2 border border-gray-600 rounded font-mono text-sm overflow-x-auto';
  if (value === null) {
    return <div className={`${codeBlockStyle} text-gray-500 italic`}>null</div>;
  }

  if (value === undefined) {
    return <div className={`${codeBlockStyle} text-gray-500 italic`}>undefined</div>;
  }

  if (typeof value === 'boolean') {
    return <div className={`${codeBlockStyle} text-blue-600`}>{value.toString()}</div>;
  }

  if (typeof value === 'number') {
    return <div className={`${codeBlockStyle} text-green-600`}>{value}</div>;
  }

  if (typeof value === 'string') {
    return <div className={`${codeBlockStyle} text-orange-200`}>&quot;{value}&quot;</div>;
  }

  if (Array.isArray(value)) {
    if (level >= maxDepth) {
      return <pre className="text-gray-500 italic">[...] ({value.length} items)</pre>;
    }

    return (
      <div className="">
        {value.map((item, index) => (
          <div key={index} className="">
            <JsonValue value={item} level={level + 1} maxDepth={maxDepth} />
          </div>
        ))}
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
      <div className="">
        <div className="mt-1">
          {keys.map((k) => (
            <div key={k} className="mb-2">
              <div className="flex flex-col gap-2">
                <div className="ml-4">
                  <strong className="min-w-0 flex-shrink-0">{k}:</strong>
                  <JsonValue value={value[k]} key={k} level={level + 1} maxDepth={maxDepth} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return <span className="text-gray-600">{String(value)}</span>;
};

export const JsonRenderer: React.FC<JsonRendererProps> = ({ data, title, level = 0, maxDepth = 5 }) => {
  return (
    <div className="rounded-lg">
      <strong className="mt-4">{title}:</strong>
      <div className="font-mono text-sm">
        <JsonValue value={data} level={level} maxDepth={maxDepth} />
      </div>
    </div>
  );
};
