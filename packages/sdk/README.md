# 🚀 AXONSTREAM CORE SDK

**The most advanced real-time collaboration platform with Magic collaboration, self-healing infrastructure, and universal framework support.**

[![npm version](https://badge.fury.io/js/%40axonstream%2Fcore.svg)](https://badge.fury.io/js/%40axonstream%2Fcore)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)

## ✨ Game-Changing Features

### 🎯 Magic Collaboration
- **Operational Transform (OT)** - Real-time conflict resolution
- **Time Travel & Branching** - Git-like versioning for collaborative documents
- **Presence Awareness** - See who's online, cursor positions, selections
- **Auto-snapshots** - Never lose work with intelligent state preservation

### 🔧 Self-Healing Infrastructure
- **Auto-reconnect** - Intelligent reconnection with exponential backoff
- **Circuit Breakers** - Prevent cascade failures
- **Retry Management** - Configurable retry strategies
- **Health Monitoring** - Real-time system health tracking

### 🌐 Universal Framework Support
- **Auto-Detection** - Automatically detects React, Vue, Angular, Svelte
- **Framework Bindings** - Native hooks, components, and utilities for each framework
- **Vanilla Fallback** - Works anywhere, even without a framework
- **Lazy Loading** - Load only what you need

### 🏢 Enterprise-Grade Features
- **Multi-Tenant RBAC** - Role-based access control
- **Real-Time Event Streaming** - Redis streams with consumer groups
- **Production Monitoring** - Latency tracking, metrics, alerts
- **Webhook Templates** - Pre-built integrations for 5000+ apps

## 🚀 Quick Start

### Installation

```bash
npm install @axonstream/core
# or
yarn add @axonstream/core
# or
pnpm add @axonstream/core
```

### Basic Usage

```typescript
import { AxonStreamClient, createUniversalAdapter } from '@axonstream/core';

// Create client
const client = new AxonStreamClient({
  url: 'wss://your-org.axonstream.ai',
  token: 'your-jwt-token'
});

// Create universal adapter (auto-detects framework)
const axon = createUniversalAdapter(client);

// Connect and subscribe
await axon.connect();
await axon.subscribe(['notifications', 'updates']);

// Listen for events
axon.on('event', (event) => {
  console.log('Received event:', event);
});

// Publish events
await axon.publish('notifications', 'user_joined', {
  userId: '123',
  userName: 'John Doe'
});
```

## 🎯 Magic Collaboration

### Create Collaborative Rooms

```typescript
// Create a Magic room
const room = await axon.magic.createRoom('document-editor', {
  content: '',
  cursor: 0
}, {
  timeTravel: true,
  presence: true,
  conflictResolution: 'operational_transform'
});

// Join the room
await axon.magic.joinRoom('document-editor', {
  userName: 'John Doe',
  userAvatar: 'https://example.com/avatar.jpg'
});

// Subscribe to real-time updates
await axon.magic.subscribeToRoom('document-editor');
```

### Real-Time Collaboration

```typescript
// Apply operations (automatically resolved with OT)
const result = await axon.magic.applyOperation('document-editor', {
  type: 'magic_set',
  path: ['content'],
  value: 'Hello, World!'
});

// Listen for remote operations
axon.on('magic_operation_received', (data) => {
  console.log('Remote operation:', data.operation);
  // Update your UI accordingly
});
```

### Time Travel & Branching

```typescript
// Create snapshots
const snapshot = await axon.timeTravel.createSnapshot(
  room.id,
  'Major milestone reached'
);

// Create branches
const featureBranch = await axon.timeTravel.createBranch(
  room.id,
  snapshot.id,
  'feature/new-editor'
);

// Merge branches
const mergeResult = await axon.timeTravel.mergeBranches(
  room.id,
  'feature/new-editor',
  'main'
);
```

### Presence Awareness

```typescript
// Update cursor position
await axon.presence.updateCursor('document-editor', 150, 200);

// Update text selection
await axon.presence.updateSelection('document-editor', 100, 150);

// Listen for presence updates
axon.on('presence_updated', (data) => {
  console.log(`${data.userName} moved cursor to`, data.cursorPosition);
});
```

## 🌐 Framework Auto-Detection

### React

```typescript
import { useAxonStream, useMagicCollaboration } from '@axonstream/core/react';

function MyComponent() {
  const { client, isConnected } = useAxonStream();
  const { createRoom, joinRoom } = useMagicCollaboration();
  
  // Use React hooks naturally
  return (
    <div>
      Status: {isConnected ? 'Connected' : 'Disconnected'}
    </div>
  );
}
```

### Vue

```typescript
import { useAxonStream } from '@axonstream/core/vue';

export default {
  setup() {
    const { client, isConnected } = useAxonStream();
    
    return {
      isConnected
    };
  }
};
```

### Angular

```typescript
import { AxonStreamService } from '@axonstream/core/angular';

@Component({...})
export class MyComponent {
  constructor(private axonStream: AxonStreamService) {}
  
  async connect() {
    await this.axonStream.connect();
  }
}
```

### Vanilla JavaScript

```typescript
import { createUniversalAdapter } from '@axonstream/core';

const axon = createUniversalAdapter(client);

// Works the same way in any environment
await axon.connect();
await axon.subscribe(['channel']);
```

## 🔧 Advanced Configuration

### Custom Configuration

```typescript
import { createUniversalAdapter, createProductionConfig } from '@axonstream/core';

const config = createProductionConfig();
config.magic.autoSnapshot = true;
config.magic.snapshotInterval = 2 * 60 * 1000; // 2 minutes

const axon = createUniversalAdapter(client, {
  enableMagic: true,
  enablePresence: true,
  enableTimeTravel: true,
  debug: false
});
```

### Environment-Specific Configs

```typescript
import { 
  createDevelopmentConfig, 
  createStagingConfig, 
  createProductionConfig 
} from '@axonstream/core';

const config = process.env.NODE_ENV === 'production' 
  ? createProductionConfig()
  : createDevelopmentConfig();
```

## 📊 Monitoring & Analytics

### Performance Metrics

```typescript
// Get connection metrics
const metrics = axon.getConnectionMetrics();
console.log('Latency:', metrics.connectionLatency);
console.log('Reconnect count:', metrics.reconnectCount);

// Health check
const health = await axon.getHealthStatus();
console.log('Status:', health.status);
console.log('Message:', health.message);
```

### Real-Time Monitoring

```typescript
// Listen for performance events
axon.on('performance_alert', (alert) => {
  console.log('Performance issue:', alert.message);
  console.log('Severity:', alert.severity);
});

// Custom metrics
axon.trackCustomMetric('user_action', {
  action: 'button_click',
  duration: 150,
  userId: '123'
});
```

## 🔌 Webhooks & Integrations

### Pre-built Templates

```typescript
import { WebhookTemplates } from '@axonstream/core';

// Use Slack template
const slackWebhook = WebhookTemplates.createFromTemplate('slack-notifications', {
  SLACK_BOT_TOKEN: 'xoxb-your-token',
  SLACK_CHANNEL: '#alerts'
});

// Use Discord template
const discordWebhook = WebhookTemplates.createFromTemplate('discord-webhooks', {
  DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/...'
});
```

### Custom Webhooks

```typescript
const webhook = await axon.webhooks.create({
  name: 'My App Webhook',
  url: 'https://myapp.com/webhooks/axonstream',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer my-api-key'
  },
  retryPolicy: {
    maxRetries: 5,
    backoffStrategy: 'exponential'
  }
});
```

## 🚀 Production Deployment

### Environment Variables

```bash
# Required
AXONSTREAM_URL=wss://your-org.axonstream.ai
AXONSTREAM_TOKEN=your-jwt-token

# Optional
AXONSTREAM_DEBUG=false
AXONSTREAM_ENABLE_MAGIC=true
AXONSTREAM_ENABLE_PRESENCE=true
AXONSTREAM_ENABLE_TIME_TRAVEL=true
```

### Health Checks

```typescript
// Implement health check endpoint
app.get('/health', async (req, res) => {
  const health = await axon.getHealthStatus();
  
  if (health.status === 'healthy') {
    res.status(200).json(health);
  } else {
    res.status(503).json(health);
  }
});
```

## 📚 API Reference

### Core Client

- `AxonStreamClient` - Main client class
- `createUniversalAdapter()` - Framework-agnostic adapter factory
- `FrameworkDetector` - Auto-detection system

### Magic Collaboration

- `MagicCollaboration` - Main collaboration class
- `MagicTimeTravel` - Time travel and branching
- `MagicPresence` - Real-time presence awareness

### Framework Adapters

- `@axonstream/core/react` - React hooks and components
- `@axonstream/core/vue` - Vue composables
- `@axonstream/core/angular` - Angular services
- `@axonstream/core/svelte` - Svelte stores

### Utilities

- `createEventId()` - Generate unique event IDs
- `validateEvent()` - Validate event objects
- `sanitizePayload()` - Remove sensitive data
- `deepClone()` - Deep clone objects

## 🔒 Security

- **JWT Authentication** - Secure token-based auth
- **Multi-Tenant Isolation** - Complete data separation
- **RBAC** - Role-based access control
- **Request Signing** - Optional request verification
- **Rate Limiting** - Built-in protection

## 📈 Performance

- **WebSocket Optimization** - Efficient real-time communication
- **Redis Streams** - High-performance event streaming
- **Lazy Loading** - Load only what you need
- **Connection Pooling** - Optimized connection management
- **Memory Management** - Automatic cleanup and optimization

## 🌟 Why Choose AxonStream?

1. **🚀 Game-Changing Features** - Magic collaboration, time travel, presence
2. **🔧 Self-Healing** - Built-in resilience and auto-recovery
3. **🌐 Universal** - Works with any framework or no framework
4. **🏢 Enterprise-Ready** - Multi-tenant, RBAC, monitoring
5. **⚡ Production-Grade** - Built for scale and reliability
6. **🎯 Developer Experience** - Intuitive API, great docs, examples

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🆘 Support

- **Documentation**: [https://docs.axonstream.ai](https://docs.axonstream.ai)
- **Discord**: [https://discord.gg/axonstream](https://discord.gg/axonstream)
- **Email**: support@axonstream.ai
- **Issues**: [GitHub Issues](https://github.com/axonstream/axonpuls-platform/issues)

---

**Built with ❤️ by the AxonStream team**

*Transform your real-time applications with the power of Magic collaboration!*
