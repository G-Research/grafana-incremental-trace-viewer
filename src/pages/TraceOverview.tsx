import React, { useState } from 'react';
import { prefixRoute } from '../utils/utils.routing';
import { useTraceFilters } from '../utils/utils.url';
import { BASE_URL, ROUTES } from '../constants';
import { testIds } from '../components/testIds';
import { lastValueFrom } from 'rxjs';
import { PluginPage, getBackendSrv } from '@grafana/runtime';
import { Combobox, Input, Field, Stack, Button, Icon, TimeRangeInput } from '@grafana/ui';
import { dateTime, TimeRange } from '@grafana/data';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { type components, ApiPaths } from '../schema.gen';

export type datasource = {
  id: number;
  uid: string;
  name: string;
  type: string;
  typeName: string;
  jsonData: {
    // Index name
    database: string;
    timeField: string;
  };
  url: string;
};

type DataSourceInfo = components['schemas']['DataSourceInfo'];
type SearchResponse = components['schemas']['TempoV1Response'];
type TempoTrace = components['schemas']['TempoTrace'];

function TraceOverview() {
  const queryClient = useQueryClient();
  const [filters, updateFilters] = useTraceFilters();

  const datasources = useSuspenseQuery<datasource[]>({
    queryKey: ['datasources'],
    queryFn: async () => {
      const response = getBackendSrv().fetch<datasource[]>({
        url: `/api/datasources`,
      });
      const value = await lastValueFrom(response);
      const datasource = value.data.filter((d) => d.type === 'tempo' || d.type === 'grafana-opensearch-datasource');
      return datasource;
    },
  });

  const [selectedSource, setSelectedSource] = useState<number | null>(null);

  const result = useQuery<TempoTrace[]>({
    queryKey: ['datasource', selectedSource, 'traces', filters],
    queryFn: async ({ queryKey }) => {
      const sourceId = queryKey[1];

      if (sourceId === null) {
        return [];
      }

      const datasource = datasources.data.find((d) => d.id === sourceId);
      if (!datasource) {
        throw new Error(`Datasource with id ${sourceId} not found`);
      }
      const q = encodeURIComponent(filters.q || '{}');
      const start = Math.floor(new Date(filters.start || '').getTime() / 1000);
      const end = Math.floor(new Date(filters.end || '').getTime() / 1000);
      const response = getBackendSrv().fetch<SearchResponse>({
        url: `${BASE_URL}${ApiPaths.search}?q=${q}&start=${start}&end=${end}`,
        method: 'POST',
        data: {
          url: datasource.url,
          type: datasource.type,
          database: datasource.jsonData.database,
          timeField: datasource.jsonData.timeField,
        } satisfies DataSourceInfo,
      });
      const value = await lastValueFrom(response);
      return value.data.traces || [];
    },
  });

  const options = datasources.data.map((s) => {
    return {
      label: s.name,
      value: s.id,
      description: s.type,
    };
  });

  const handleClearFilters = () => {
    updateFilters({
      start: undefined,
      end: undefined,
      q: undefined,
    });
  };

  const hasActiveFilters = filters.start || filters.end || filters.q;

  const handleTimeRangeChange = (timeRange: TimeRange) => {
    updateFilters({
      start: timeRange.from.toISOString(),
      end: timeRange.to.toISOString(),
    });
  };

  const getTimeRangeValue = (): TimeRange => {
    const from = filters.start ? dateTime(filters.start) : dateTime().subtract(1, 'hour');
    const to = filters.end ? dateTime(filters.end) : dateTime();
    return {
      from,
      to,
      raw: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
    };
  };

  return (
    <PluginPage>
      <div data-testid={testIds.pageOne.container}>
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Trace Overview</h2>

          <Stack direction="column">
            {/* Datasource Selection */}
            <div className="mb-6">
              <Field label="Datasource">
                <Combobox
                  options={options}
                  placeholder="Select a datasource"
                  onChange={(o) => {
                    const datasource = datasources.data.find((d) => d.id === o.value);
                    if (datasource) {
                      queryClient.setQueryData<datasource[]>(['datasource', o.value], datasources.data, {});
                      setSelectedSource(o.value);
                    }
                  }}
                />
              </Field>
            </div>

            {/* Filters */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Filters</h3>
                {hasActiveFilters && (
                  <Button variant="secondary" size="sm" onClick={handleClearFilters} icon="times">
                    Clear Filters
                  </Button>
                )}
              </div>

              <Stack direction="row">
                {/* Time Range Filter */}
                <Field label="Time Range">
                  <TimeRangeInput value={getTimeRangeValue()} onChange={handleTimeRangeChange} showIcon />
                </Field>

                {/* Name Filter */}
                <Field label="Trace Name Filter">
                  <Input
                    value={filters.q || ''}
                    onChange={(e) => updateFilters({ q: e.currentTarget.value })}
                    placeholder="Filter by trace name..."
                    prefix={<Icon name="search" />}
                  />
                </Field>
              </Stack>
            </div>
          </Stack>
          {/* Results */}
          {result.isLoading && (
            <div className="text-center py-8">
              <Icon name="spinner" className="animate-spin text-2xl" />
              <p className="mt-2">Loading traces...</p>
            </div>
          )}

          {result.isError && (
            <div className="text-center py-8 text-red-600">
              <Icon name="exclamation-triangle" className="text-2xl" />
              <p className="mt-2">Error loading traces: {result.error?.message}</p>
            </div>
          )}

          {result.isSuccess && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Traces</h3>
                <span className="text-sm text-gray-500">
                  {result.data.length} trace{result.data.length !== 1 ? 's' : ''} found
                </span>
              </div>

              {result.data.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Icon name="info-circle" className="text-2xl" />
                  <p className="mt-2">No traces found matching the current filters</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {result.data.map((r) => {
                    return (
                      <Link key={r.traceID} to={prefixRoute(`${selectedSource}/${ROUTES.TraceDetails}/${r.traceID}`)}>
                        <li className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-medium">
                                {r.rootTraceName}({r.rootServiceName})
                              </span>
                            </div>
                            {r.startTime && (
                              <div className="text-sm text-gray-500">{new Date(r.startTime).toLocaleString()}</div>
                            )}
                          </div>
                        </li>
                      </Link>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </PluginPage>
  );
}

export default TraceOverview;
