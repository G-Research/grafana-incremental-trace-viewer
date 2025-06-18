import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppRootProps } from '@grafana/data';
import { ROUTES } from '../../constants';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../contexts/ThemeContext';

const TraceOverview = React.lazy(() => import('../../pages/TraceOverview'));
const TraceDetail = React.lazy(() => import('../../pages/TraceDetail'));
const queryClient = new QueryClient();

function App(props: AppRootProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Routes>
          <Route path={`:datasourceId/${ROUTES.TraceDetails}/:traceId/:spanId`} element={<TraceDetail />} />
          {/* Default page */}
          <Route path="*" element={<TraceOverview />} />
        </Routes>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
