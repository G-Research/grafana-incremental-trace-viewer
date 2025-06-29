import { useSearchParams } from 'react-router-dom';

export interface TraceFilters {
  start?: string;
  end?: string;
  q?: string;
}

export function useTraceFilters(): [TraceFilters, (filters: Partial<TraceFilters>) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters: TraceFilters = {
    start: searchParams.get('start') || undefined,
    end: searchParams.get('end') || undefined,
    q: searchParams.get('q') || undefined,
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
