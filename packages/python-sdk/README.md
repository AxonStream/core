# AxonPuls Python Client

Enterprise-grade Python client for the AxonPuls real-time platform with multi-tenant support, circuit breaker patterns, and comprehensive error handling.

## Features

- 🔐 **Multi-tenant isolation** with JWT-based authentication
- 🔄 **Auto-reconnection** with exponential backoff and jitter
- 🛡️ **Circuit breaker** pattern for resilience
- 📊 **Real-time events** via WebSocket with Redis Streams
- 🔍 **Event replay** functionality
- 📏 **Size limits** and validation
- 🎯 **Type safety** with comprehensive typing

## Installation

```bash
pip install AxonPuls-client
```

## Quick Start

```python
import asyncio
from AxonPuls_client import create_org_client

async def main():
    # Create client for your organization
    client = await create_org_client(
        org_id="your-org-id",
        token="your-jwt-token",
        gateway_url="wss://api.AxonPuls.dev"
    )
    
    # Subscribe to events
    await client.subscribe(["org:your-org-id:notifications"])
    
    # Handle events
    def handle_notification(event):
        print(f"Received: {event['type']} - {event['payload']}")
    
    client.on("notification", handle_notification)
    
    # Publish events
    await client.publish(
        channel="org:your-org-id:notifications",
        event_type="user.created",
        payload={"user_id": "123", "email": "user@example.com"}
    )
    
    # Keep connection alive
    try:
        await asyncio.sleep(3600)  # Run for 1 hour
    finally:
        await client.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
```

## Advanced Usage

### Manual Client Configuration

```python
from AxonPuls_client import AxonPulsClient, AxonPulsClientConfig

config = AxonPulsClientConfig(
    url="wss://api.AxonPuls.dev",
    token="your-jwt-token",
    client_type="my-python-app",
    auto_reconnect=True,
    heartbeat_interval=30,
    reconnect_attempts=5,
    debug=True
)

client = AxonPulsClient(config)
await client.connect()
```

### Event Handling

```python
# Handle specific event types
client.on("user.created", handle_user_created)
client.on("order.processed", handle_order_processed)

# Handle all events
def handle_all_events(event):
    print(f"Event: {event}")

client.on("*", handle_all_events)
```

### Event Replay

```python
# Replay last 100 events
await client.replay("org:your-org-id:orders")

# Replay since specific stream ID
await client.replay(
    channel="org:your-org-id:orders",
    since_id="1640995200000-0",
    count=50
)
```

### Error Handling

```python
from AxonPuls_client import (
    AxonPulsConnectionError,
    AxonPulsAuthenticationError,
    AxonPulsValidationError,
    AxonPulsTenantIsolationError
)

try:
    await client.connect()
except AxonPulsConnectionError as e:
    print(f"Connection failed: {e}")
except AxonPulsAuthenticationError as e:
    print(f"Authentication failed: {e}")
```

## Multi-Tenant Architecture

AxonPuls enforces strict tenant isolation. All channels must be prefixed with your organization ID:

```python
# ✅ Correct - includes org prefix
await client.subscribe(["org:your-org-id:notifications"])

# ❌ Incorrect - will raise AxonPulsTenantIsolationError
await client.subscribe(["global-notifications"])
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | `str` | Required | WebSocket gateway URL |
| `token` | `str` | Required | JWT authentication token |
| `client_type` | `str` | `"python"` | Client identifier |
| `auto_reconnect` | `bool` | `True` | Enable automatic reconnection |
| `heartbeat_interval` | `int` | `30` | Heartbeat interval in seconds |
| `reconnect_attempts` | `int` | `5` | Maximum reconnection attempts |
| `debug` | `bool` | `False` | Enable debug logging |

## Error Handling

The client includes comprehensive error handling with specific exception types:

- `AxonPulsConnectionError` - Connection-related issues
- `AxonPulsAuthenticationError` - Authentication failures
- `AxonPulsValidationError` - Payload or parameter validation errors
- `AxonPulsTenantIsolationError` - Multi-tenant isolation violations
- `AxonPulsRateLimitError` - Rate limiting exceeded
- `AxonPulsCircuitBreakerError` - Circuit breaker protection

## Circuit Breaker

The client includes a circuit breaker that:
- Opens after 5 consecutive failures
- Stays open for 60 seconds
- Automatically transitions to half-open state
- Protects against cascading failures

## Logging

Enable debug logging to troubleshoot connection issues:

```python
import logging
logging.basicConfig(level=logging.DEBUG)

config = AxonPulsClientConfig(
    url="wss://api.AxonPuls.dev",
    token="your-token",
    debug=True
)
```

## Requirements

- Python 3.8+
- asyncio support
- WebSocket connection capability

## License

MIT License - see LICENSE file for details.
