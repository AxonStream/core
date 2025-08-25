# AxonStream Core

> **ONE PACKAGE FOR EVERYTHING** - Revolutionary real-time platform in a single package

[![npm version](https://badge.fury.io/js/%40axonstream%2Fcore.svg)](https://badge.fury.io/js/%40axonstream%2Fcore)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

## 🚀 Revolutionary Simplicity

**One command, one package, infinite possibilities.**

```bash
npm install @axonstream/core
```

That's it! One command installs everything you need for modern real-time applications:

- ✅ **Core SDK** - Complete real-time SDK with WebSocket connections
- ✅ **React Hooks** - React hooks for real-time state management
- ✅ **Vue Composables** - Vue 3 composables for reactive data
- ✅ **Angular Services** - Angular services with RxJS integration
- ✅ **UI Components** - Pre-built components for real-time features
- ✅ **CDN & Embed** - No-build integration for any website

## 🌟 Why AxonStream Core?

### **Revolutionary Approach**
- **One Package**: Everything in a single, comprehensive package
- **Zero Configuration**: Works out of the box with sensible defaults
- **Framework Agnostic**: React, Vue, Angular, or vanilla JavaScript
- **Enterprise Ready**: Multi-tenant, RBAC, audit logging, monitoring

### **Professional Features**
- **Real-time Messaging**: WebSocket-based event streaming
- **Multi-tenancy**: Organization isolation and data security
- **Authentication**: JWT-based auth with RS256
- **Monitoring**: Health checks, metrics, and performance analytics
- **Audit Logging**: Comprehensive activity tracking for compliance

## 📦 Installation

```bash
# Install the complete package
npm install @axonstream/core

# Or with yarn
yarn add @axonstream/core

# Or with pnpm
pnpm add @axonstream/core
```

## 🚀 Quick Start

### React Integration
```jsx
import { useAxonpuls } from '@axonstream/core/react';

function ChatApp() {
  const axon = useAxonpuls({
    org: 'your-org',
    token: 'your-jwt-token'
  });

  return <div>Real-time chat ready!</div>;
}
```

### Vue Integration
```vue
<script setup>
import { useAxonpuls } from '@axonstream/core/vue';

const axon = useAxonpuls({
  org: 'your-org',
  token: 'your-jwt-token'
});
</script>
```

### Angular Integration
```typescript
import { AxonStreamService } from '@axonstream/core/angular';

@Injectable()
export class ChatService {
  constructor(private axon: AxonStreamService) {
    this.axon.connect({
      org: 'your-org',
      token: 'your-jwt-token'
    });
  }
}
```

### CDN Integration (No Build Required)
```html
<script src="https://cdn.axonstream.ai/axonui.min.js"></script>
<script>
const axon = new window.AxonSDK({
  url: 'wss://your-org.axonstream.ai',
  token: 'your-jwt-token'
});
await axon.connect();
</script>
```

## 📚 Documentation

- **[📖 Full Documentation](https://docs.axonstream.ai)** - Complete guides and API reference
- **[🚀 Quick Start Guide](https://docs.axonstream.ai/quick-start)** - Get started in minutes
- **[🔧 API Reference](https://docs.axonstream.ai/api-docs)** - Complete API documentation
- **[🧪 Testing Interface](https://docs.axonstream.ai/testing)** - Interactive API testing

## 🏗️ Architecture

### **Core Components**
- **AxonPuls Gateway**: High-performance WebSocket gateway
- **Event Router**: Central real-time event bus
- **Subscription Manager**: Channel-based subscriptions
- **Message Queue**: Redis-backed message queuing
- **Connection Manager**: Connection state tracking
- **Retry Manager**: Exponential backoff strategy
- **Latency Tracker**: Performance monitoring
- **Audit Logger**: Comprehensive activity logging

### **Technology Stack**
- **Framework**: NestJS with Fastify adapter
- **WebSocket**: uWebSockets.js for high-performance connections
- **Database**: PostgreSQL with Prisma ORM
- **Cache/Streams**: Redis with Consumer Groups
- **Validation**: Zod for runtime type safety
- **Authentication**: JWT with Passport.js
- **Testing**: Jest with comprehensive test coverage

## 🔧 Development

### **Prerequisites**
- Node.js 20+
- PostgreSQL
- Redis

### **Setup**
```bash
# Clone the repository
git clone https://github.com/AxonStream/core.git
cd core

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Setup database
npm run db:migrate
npm run db:generate

# Start development servers
npm run dev
```

### **Available Scripts**
```bash
# Development
npm run dev              # Start all services in development
npm run dev:api          # Start API server only
npm run dev:docs         # Start documentation server

# Building
npm run build            # Build all packages
npm run build:sdk        # Build SDK package
npm run build:docs       # Build documentation

# Testing
npm run test             # Run all tests
npm run test:api         # Run API tests
npm run test:e2e         # Run end-to-end tests

# Publishing
npm run publish:all      # Publish all packages
npm run pack:all         # Pack all packages locally
```

## 🌐 API Endpoints

### **Base URLs**
- **API**: `http://localhost:3001/api/v1`
- **WebSocket**: `ws://localhost:3001`
- **Documentation**: `http://localhost:3001/api/docs`

### **Key Endpoints**
- `POST /auth/login` - User authentication
- `POST /events/publish` - Publish events
- `GET /events/history` - Retrieve event history
- `POST /subscriptions/create` - Create subscriptions
- `GET /health` - Health check
- `GET /metrics` - Performance metrics

## 🔒 Security

### **Authentication & Authorization**
- JWT RS256 tokens with automatic rotation
- Role-Based Access Control (RBAC) with granular permissions
- Multi-tenant isolation with organization-scoped data
- Session management with secure token storage

### **Data Protection**
- Encryption at rest using AES-256
- Encryption in transit via TLS 1.3
- Data isolation between tenants
- Input validation using Zod schemas

### **Network Security**
- CORS configuration for cross-origin requests
- Rate limiting to prevent abuse
- DDoS protection with connection limits
- WebSocket security with origin validation

## 📊 Monitoring

### **Built-in Monitoring**
- Connection metrics and throughput
- Message latency tracking
- Error rates and performance analytics
- Resource usage monitoring
- Real-time health checks

### **Observability**
- Comprehensive audit logging
- Security event monitoring
- Performance trend analysis
- Compliance reporting

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### **Development Workflow**
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **[📚 Documentation](https://docs.axonstream.ai)** - Complete guides and tutorials
- **[🐛 Issues](https://github.com/AxonStream/core/issues)** - Report bugs and request features
- **[💬 Discussions](https://github.com/AxonStream/core/discussions)** - Ask questions and share ideas
- **[📧 Email](mailto:info@axonstream.ai)** - Direct support

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=AxonStream/core&type=Date)](https://star-history.com/#AxonStream/core&Date)

---

**Made with ❤️ by [AxonStream AI](https://axonstream.ai)**

> **Revolutionary real-time platform in a single package. One command, infinite possibilities.**