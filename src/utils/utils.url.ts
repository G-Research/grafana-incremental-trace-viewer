import { useSearchParams } from 'react-router-dom';

export interface TraceFilters {
  start?: string;
  end?: string;
  q?: string;
}

const ONE_WEEK = 604800;

const defaultFilters = (): TraceFilters => {
  const start = Math.floor(Date.now() / 1000) - ONE_WEEK;
  const end = Math.floor(Date.now() / 1000);
  return {
    start: start.toString(),
    end: end.toString(),
    q: undefined,
  };
};

export function useTraceFilters(): [TraceFilters, (filters: Partial<TraceFilters>) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters: TraceFilters = {
    start: searchParams.get('start') || defaultFilters().start,
    end: searchParams.get('end') || defaultFilters().end,
    q: searchParams.get('q') || defaultFilters().q,
  };

  const updateFilters = (newFilters: Partial<TraceFilters>) => {
    const updatedParams = new URLSearchParams(searchParams);

    Object.entries(newFilters).forEach(([key, value]) => {
      if (value === undefined || value === '') {
        updatedParams.delete(key);
      } else {
        updatedParams.set(key, value);
      }
    });

    setSearchParams(updatedParams, { replace: true });
  };

  return [filters, updateFilters];
}
