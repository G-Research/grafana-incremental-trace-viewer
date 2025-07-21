# Trace Viewer Help Documentation

This document contains all the help content for the Grafana Incremental Trace Viewer plugin. The help is displayed in modals within the plugin interface and is also available here for reference.

## Panel Too Small

### Current Panel Size

- **Width:** {currentWidth}px
- **Height:** {currentHeight}px
- **Minimum required:** 600px × 300px

### How to Resize the Panel

#### Step 1: Enter Edit Mode

Click the **edit** icon in the top-right corner of the dashboard.

#### Step 2: Resize Panel

Click and drag the bottom-right corner of this panel to make it larger.

#### Step 3: Save Changes

Click **Save** in the top-right corner to apply your changes.

> **💡 Tip:** For optimal trace visualization, we recommend a panel size of at least 800px × 400px.

---

## No Trace Data Available

### No Traces Found

The current query returned no trace data. This could be due to:

- **Time Range**: No traces in the selected time range
- **Query String**: Query filters are too restrictive
- **Data Source**: Connection issues with the data source
- **No Data**: No traces have been sent to the system

### How to Update the Query

#### Step 1: Enter Edit Mode

Click the **edit** icon in the top-right corner of the dashboard.

#### Step 2: Edit Panel

Click on this panel to open the query editor.

#### Step 3: Adjust Time Range

- **Expand the time range** to include more historical data
- **Try "Last 1 hour"** or "Last 24 hours" instead of shorter periods
- **Use custom time range** to check specific periods

#### Step 4: Modify Query String

- **Start with a simple query**: `{}` to see all traces
- **Remove restrictive filters** from your current query
- **Try broader service names** or remove service filters entirely

#### Step 5: Save Changes

Click **Save** in the top-right corner to apply your changes.

### Example TraceQL Queries

#### Start Simple

```traceql
{}                    // Show all traces (recommended first step)
```

#### Filter by Service

```traceql
{service.name="my-service"}  // Replace with your service name
{service.name="api"}         // Common service names
```

#### Filter by Duration

```traceql
{duration > 1s}      // Show slow traces
{duration < 100ms}   // Show fast traces
```

### Common Time Ranges to Try

- **Last 1 hour** - Recent traces
- **Last 6 hours** - Medium-term traces
- **Last 24 hours** - Daily traces
- **Last 7 days** - Weekly traces
- **Custom range** - Specific time periods

> **💡 Tip:** Start with `{}` and "Last 24 hours" to see if any traces exist, then narrow down your search.

---

## Trace Viewer Help

### Understanding Distributed Tracing

The trace viewer displays a visual representation of **distributed traces**. Each trace is a collection of spans, which represent individual operations or steps in a distributed system.

### Key Concepts

#### Trace

A collection of spans that represent a single request or transaction across multiple services.

#### Span

An individual operation or step within a trace. Spans can be nested, representing parent-child relationships.

#### Service

A logical component or service within a distributed system (e.g., API Gateway, User Service, Database).

#### Duration

The total time taken for a trace or a span, typically measured in milliseconds or microseconds.

### Using the Trace Viewer

#### Navigation

- **Click on spans** to view detailed information
- **Use the timeline** to understand timing relationships
- **Expand/collapse** spans to see child operations

#### Querying Traces

Use **TraceQL** queries to filter and find specific traces:

```traceql
{}                    // Show all traces
{service.name="api"}  // Filter by service
{duration > 500ms}    // Filter by duration
{error=true}          // Show only error traces
```

#### Panel Configuration

- **Resize the panel** for better visualization
- **Adjust time range** to focus on specific periods
- **Modify queries** to find relevant traces

> **💡 Tip:** Start with a simple query like `{}` to see all available traces, then refine your search based on what you find.

---

## Advanced Usage

### TraceQL Query Examples

#### Basic Queries

```traceql
{}                           // All traces
{service.name="web"}         // Traces from web service
{operation="GET /api/users"} // Specific operation
```

#### Duration Filters

```traceql
{duration > 1s}              // Traces longer than 1 second
{duration < 100ms}           // Traces shorter than 100ms
{duration >= 500ms && duration <= 2s}  // Range filter
```

#### Error Traces

```traceql
{error=true}                 // Only error traces
{status="error"}             // Alternative error syntax
```

#### Complex Queries

```traceql
{service.name="api" && duration > 500ms && operation="POST"}
{service.name="database" || service.name="cache"}
{service.name="api" && (duration > 1s || error=true)}
```

### Best Practices

1. **Start Simple**: Begin with `{}` to see all available traces
2. **Filter Gradually**: Add filters one at a time to narrow down results
3. **Use Time Ranges**: Adjust the dashboard time range to focus on relevant periods
4. **Monitor Performance**: Large queries may take time to load
5. **Save Useful Queries**: Save dashboard configurations with helpful queries

### Troubleshooting

#### No Traces Appearing

- Check the time range in the dashboard
- Verify the data source connection
- Ensure traces are being sent to the system
- Try a broader query like `{}`

#### Panel Too Small

- Enter edit mode and resize the panel
- Minimum size: 600px × 300px
- Recommended size: 800px × 400px or larger

#### Slow Performance

- Reduce the time range
- Use more specific queries
- Check data source performance
- Consider using smaller panel sizes

---

## Plugin Features

### Incremental Loading

The plugin loads traces incrementally for better performance with large datasets.

### Real-time Updates

Traces update automatically as new data becomes available.

### Interactive Timeline

Click and drag on the timeline to explore different time periods.

### Span Details

Click on any span to view detailed information including:

- Span attributes
- Timing information
- Parent-child relationships
- Error details (if applicable)

### Export Capabilities

- Copy trace IDs for external analysis
- Share dashboard configurations
- Export trace data (if supported by data source)
