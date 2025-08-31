# axonstream CLI

Command-line interface for managing the axonstream real-time platform. Test connections, publish events, subscribe to channels, and monitor your platform.

## Installation

```bash
npm install -g @axonstream/cli
```

## Quick Start

1. **Configure your connection:**
```bash
axonstream config set gateway_url wss://api.axonstream.ai
axonstream config set token your-jwt-token
```

2. **Test connection:**
```bash
axonstream connect
```

3. **Publish an event:**
```bash
axonstream publish org:myorg:notifications user.created '{"userId": "123", "email": "user@example.com"}'
```

4. **Subscribe to events:**
```bash
axonstream subscribe org:myorg:notifications
```

## Commands

### Connection Management

```bash
# Test connection to axonstream gateway
axonstream connect [options]

Options:
  -u, --url <url>       Gateway WebSocket URL
  -t, --token <token>   Authentication token
  -o, --org <orgId>     Organization ID
```

### Event Publishing

```bash
# Publish event to channel
axonstream publish <channel> <type> [payload] [options]

Arguments:
  channel               Channel name (e.g., org:myorg:notifications)
  type                  Event type
  payload               Event payload (JSON string)

Options:
  -f, --file <path>     Read payload from file
  -i, --interactive     Interactive payload input
  -d, --delivery <guarantee>  Delivery guarantee (at_least_once|at_most_once)
  -k, --partition-key <key>   Partition key
```

Examples:
```bash
# Simple event
axonstream publish org:myorg:alerts system.error '{"code": 500, "message": "Internal error"}'

# From file
axonstream publish org:myorg:orders order.created --file order-payload.json

# Interactive mode
axonstream publish org:myorg:users user.updated --interactive

# With delivery guarantee
axonstream publish org:myorg:payments payment.processed '{"amount": 100}' --delivery at_least_once
```

### Event Subscription

```bash
# Subscribe to channels and listen for events
axonstream subscribe <channels...> [options]

Arguments:
  channels              Channel names to subscribe to

Options:
  -r, --replay-from <id>     Replay events from stream ID
  -n, --replay-count <count> Number of events to replay (default: 100)
  -f, --filter <filter>      Event filter pattern
  -o, --output <format>      Output format (json|table|raw, default: json)
  --save <file>              Save events to file
```

Examples:
```bash
# Subscribe to single channel
axonstream subscribe org:myorg:notifications

# Subscribe to multiple channels
axonstream subscribe org:myorg:orders org:myorg:payments

# With replay
axonstream subscribe org:myorg:orders --replay-count 50

# Table output
axonstream subscribe org:myorg:users --output table

# Save to file
axonstream subscribe org:myorg:logs --save events.jsonl
```

### Event Replay

```bash
# Replay historical events from channel
axonstream replay <channel> [options]

Arguments:
  channel               Channel name

Options:
  -s, --since <id>      Start from stream ID
  -n, --count <count>   Number of events to replay (default: 100)
  -o, --output <format> Output format (json|table|raw, default: json)
  --save <file>         Save events to file
```

### Platform Monitoring

```bash
# Monitor platform health and metrics
axonstream monitor [options]

Options:
  -i, --interval <seconds>   Refresh interval (default: 5)
  -m, --metrics <types>      Metrics to show (connections,events,errors)
  --dashboard                Show interactive dashboard
```

### Authentication

```bash
# Show authentication status
axonstream auth status

# Validate token
axonstream auth token --validate

# Decode token information
axonstream auth token --decode

# Logout (clear stored token)
axonstream auth logout
```

### Configuration

```bash
# List all configuration
axonstream config list

# Set configuration value
axonstream config set <key> <value>

# Get configuration value
axonstream config get <key>

# Reset to defaults
axonstream config reset
```

Configuration keys:
- `gateway_url` - WebSocket gateway URL
- `token` - Authentication JWT token
- `organization_id` - Default organization ID
- `default_output_format` - Default output format (json|table|raw)
- `auto_reconnect` - Enable auto-reconnection (true|false)
- `heartbeat_interval` - Heartbeat interval in seconds
- `debug` - Enable debug logging (true|false)

### Testing & Debugging

```bash
# Test WebSocket connection
axonstream test connection

# Measure round-trip latency
axonstream test latency --count 10

# Test event throughput
axonstream test throughput --events 1000 --concurrent 5
```

## Environment Variables

You can also use environment variables instead of configuration:

```bash
export axonstream_GATEWAY_URL=wss://api.axonstream.ai
export axonstream_TOKEN=your-jwt-token
export axonstream_ORG_ID=your-org-id
```

## Multi-Tenant Usage

axonstream enforces strict tenant isolation. All channels must include your organization prefix:

```bash
# ✅ Correct - includes org prefix
axonstream subscribe org:your-org-id:notifications

# ❌ Incorrect - will be rejected
axonstream subscribe global-notifications
```

## Output Formats

### JSON (default)
```json
{
  "id": "event-123",
  "type": "user.created",
  "payload": {"userId": "456"},
  "timestamp": 1640995200000,
  "metadata": {
    "org_id": "myorg",
    "channel": "org:myorg:users"
  }
}
```

### Table
```
┌─────────────────┬────────────────────────────────────┐
│ Field           │ Value                              │
├─────────────────┼────────────────────────────────────┤
│ ID              │ event-123                          │
│ Type            │ user.created                       │
│ Timestamp       │ 12/31/2021, 12:00:00 PM           │
│ Channel         │ org:myorg:users                    │
│ Payload         │ {"userId": "456"}                  │
└─────────────────┴────────────────────────────────────┘
```

### Raw
```
[12/31/2021, 12:00:00 PM] user.created: {"userId": "456"}
```

## Error Handling

The CLI provides detailed error messages for common issues:

- **Connection errors** - Network, authentication, or gateway issues
- **Validation errors** - Invalid payloads, channels, or parameters
- **Tenant isolation violations** - Attempting to access other organizations
- **Rate limiting** - When request limits are exceeded

## Examples

### Real-time Order Processing
```bash
# Terminal 1: Subscribe to orders
axonstream subscribe org:ecommerce:orders --output table

# Terminal 2: Publish new order
axonstream publish org:ecommerce:orders order.created '{
  "orderId": "order-123",
  "customerId": "customer-456",
  "items": [{"sku": "WIDGET-1", "quantity": 2}],
  "total": 29.99
}'
```

### System Monitoring
```bash
# Monitor platform health
axonstream monitor --dashboard

# Subscribe to error events
axonstream subscribe org:myorg:errors --filter "severity=critical"
```

### Development & Testing
```bash
# Test connection
axonstream connect --verbose

# Measure latency
axonstream test latency --count 100

# Load test
axonstream test throughput --events 10000 --size 1024
```

## Global Options

- `-c, --config <path>` - Configuration file path (default: ~/.axonstreamrc)
- `-v, --verbose` - Enable verbose logging  
- `--no-color` - Disable colored output

## License

MIT License - see LICENSE file for details.
