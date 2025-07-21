# GR Incremental Trace Viewer Dashboard

This dashboard provides an enhanced trace viewing experience for Grafana with incremental loading capabilities. It's designed to work with Tempo for distributed tracing and includes a custom panel plugin for better trace visualization.

## Dashboard Setup

### Prerequisites

- Docker and Docker Compose

### 1. Start the Services

```bash
# Start all services (Grafana, Tempo, OpenTelemetry Collector)
docker-compose up -d
```

This will start:

- **Grafana** on `http://localhost:3000` (admin/admin)
- **Tempo** on `http://localhost:3200`
- **OpenTelemetry Collector** on various ports (4317, 4318, 55679, 9464)

### 2. Access the Dashboard

1. Open Grafana at `http://localhost:3000`
2. Login with `admin` / `admin`
3. Navigate to **Dashboards** → **GR Plugin** folder
4. Open the **"GR Incremental Trace Viewer"** dashboard

## Dashboard Configuration

### Custom Trace Panel

The dashboard includes a custom panel plugin (`gresearch-grafanaincrementaltraceviewer-panel`) that provides:

- **Incremental Loading**: Traces are loaded progressively for better performance
- **Advanced TraceQL Queries**: Support for complex trace filtering and search
- **Real-time Updates**: Live trace data updates
- **Custom Visualization**: Enhanced trace viewing experience

### Dashboard Settings

The dashboard is automatically provisioned with:

- **Datasource**: Connected to Tempo for trace data
- **Time Range**: Default 7-day view (configurable)
- **TraceQL Query**: Empty query `{}` to show all traces (limit: 20)
- **Panel Size**: Full-width panel for optimal viewing

## Configuration Files

### Docker Compose Setup

The `docker-compose.yaml` includes:

```yaml
grafana:
  volumes:
    - ./provisioning:/etc/grafana/provisioning
  environment:
    - GF_PATHS_PROVISIONING=/etc/grafana/provisioning
  depends_on:
    - tempo
```

### Provisioning Files

- **`provisioning/dashboards/dashboard.yml`**: Dashboard provider configuration
- **`provisioning/dashboards/gr-dashboard.json`**: Dashboard definition with custom panel

### Tempo Configuration

Tempo is configured with:

- **Config**: `tempo-config.yaml`
- **Ports**: 3200 (API), 9095 (metrics)
- **Storage**: Local storage (configurable for production)
