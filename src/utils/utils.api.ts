import { lastValueFrom } from 'rxjs';
import { getBackendSrv } from '@grafana/runtime';

type ValueOneofCase =
  | 'none'
  | 'stringValue'
  | 'boolValue'
  | 'intValue'
  | 'doubleValue'
  | 'arrayValue'
  | 'kvlistValue'
  | 'bytesValue';

type ArrayValue = {
  readonly values?: AnyValue[] | null;
};

type KeyValueList = {
  readonly values?: KeyValue[] | null;
};

export type AnyValue = {
  stringValue?: string | null;
  boolValue?: boolean;
  intValue?: number;
  doubleValue?: number;
  arrayValue?: ArrayValue;
  kvlistValue?: KeyValueList;
  bytesValue?: number[] | null;
  valueCase?: ValueOneofCase;
};

export type KeyValue = {
  key?: string | null;
  value?: AnyValue;
};

export type Span = {
  traceId?: string;
  spanID?: string;
  name?: string | null;
  startTimeUnixNano?: string;
  durationNanos?: string;
  readonly attributes?: KeyValue[];
};

type SpanSet = {
  readonly spans?: Span[];
  readonly matched?: number;
};

export type Trace = {
  readonly traceID: string;
  readonly startTimeUnixNano?: string;
  readonly durationMs?: string;
  readonly spanSets?: SpanSet[];
  readonly rootServiceName?: string;
  readonly rootTraceName?: string;
};

export type SearchResponse = {
  traces?: Trace[];
};

export async function search(
  datasourceUid: string,
  query: string,
  start: number,
  end: number,
  spss?: number
): Promise<SearchResponse> {
  // The end always needs to be greater than the start. If not, we get a bad request from the Tempo API.
  const validEnd = start < end ? end : end + 1;
  const responses = getBackendSrv().fetch<SearchResponse>({
    url: `/api/datasources/proxy/uid/${datasourceUid}/api/search?q=${encodeURIComponent(
      query
    )}&start=${start}&end=${validEnd}${spss ? `&spss=${spss}` : ''}`,
    method: 'GET',
  });
  const response = await lastValueFrom(responses);
  return response.data;
}

type SearchTagsResponse = {
  scopes: Array<{
    name: string;
    tags: string[];
  }>;
};

export async function searchTags(datasourceUid: string, query: string, start: number, end: number): Promise<string[]> {
  // The end always needs to be greater than the start. If not, we get a bad request from the Tempo API.
  const validEnd = start < end ? end : end + 1;
  const responses = getBackendSrv().fetch<SearchTagsResponse>({
    url: `/api/datasources/proxy/uid/${datasourceUid}/api/v2/search/tags?q=${encodeURIComponent(
      query
    )}&start=${start}&end=${validEnd}&scope=span`,
    method: 'GET',
  });
  const response = await lastValueFrom(responses);
  return response.data.scopes.find((scope) => scope.name === 'span')?.tags || [];
}

export const flattenObject = (obj: any, prefix = ''): Record<string, any> => {
  const flattened: Record<string, any> = {};

  // Handle array of key-value pairs with typed values
  if (Array.isArray(obj)) {
    obj.forEach((item: any) => {
      if (item && typeof item === 'object' && 'key' in item && 'value' in item) {
        const key = item.key;
        const value = item.value;

        // Extract the actual value based on the type
        let actualValue: any = null;
        // typeof null === 'object' in JS, so we need explicit null check to avoid accessing properties on null
        if (typeof value === 'object' && value !== null) {
          // Check for type-specific value fields
          if ('intValue' in value) {
            actualValue = parseInt(value.intValue, 10);
          } else if ('stringValue' in value) {
            actualValue = value.stringValue;
          } else if ('boolValue' in value) {
            actualValue = value.boolValue;
          } else if ('doubleValue' in value) {
            actualValue = parseFloat(value.doubleValue);
          } else if ('bytesValue' in value) {
            actualValue = value.bytesValue;
          } else {
            // Fallback to JSON string if unknown type
            actualValue = JSON.stringify(value);
          }
        } else {
          actualValue = value;
        }

        const newKey = prefix ? `${prefix}.${key}` : key;
        flattened[newKey] = actualValue;
      }
    });
  } else if (typeof obj === 'object' && obj !== null) {
    // Handle regular nested objects
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
  }

  return flattened;
};
