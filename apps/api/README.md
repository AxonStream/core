# AxonPuls Real-Time Backend

Production-grade WebSocket and event streaming platform built with NestJS, Fastify, and Redis Streams.

## 🚀 Features

- **High-Performance WebSocket Gateway** using uWebSockets.js
- **Redis Streams** for event storage and streaming
- **Redis Consumer Groups** for scalable event consumption
- **Multi-Tenant Architecture** with organization-scoped isolation
- **JWT Authentication** with RS256 and multi-tenant claims
- **Event Replay & Offline Message Buffering**
- **Real-Time State Synchronization** across clients
- **Comprehensive Monitoring** with latency tracking and audit logging

## 🏗️ Architecture

### Core Components

- **AxonPulsGateway**: Primary WebSocket gateway managing connection lifecycle
- **EventRouter**: Central real-time event bus for message routing
- **SubscriptionManager**: Channel-based subscriptions with permission enforcement
- **MessageQueueManager**: Redis-backed message queue with durability
- **ConnectionManager**: Connection state tracking and heartbeat management
- **RetryManager**: Exponential backoff strategy for guaranteed delivery
- **LatencyTracker**: Performance monitoring and QoS optimization
- **AuditLogger**: Comprehensive activity logging for compliance

### Technology Stack

- **Framework**: NestJS with Fastify adapter
- **WebSocket**: uWebSockets.js for high-performance connections
- **Database**: PostgreSQL with Prisma ORM
- **Cache/Streams**: Redis with Consumer Groups
- **Validation**: Zod for runtime type safety
- **Authentication**: JWT with Passport.js
- **Testing**: Jest with comprehensive test coverage

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd aug-AxonPuls
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Setup database**
   ```bash
   npm run prisma:migrate
   npm run prisma:generate
   ```

5. **Start Redis server**
   ```bash
   # Make sure Redis is running on localhost:6379
   redis-server
   ```

## 🚀 Running the Application

### Development
```bash
npm run start:dev
```

### Production
```bash
npm run build
npm run start:prod
```

### Debug Mode
```bash
npm run start:debug
```

## 📊 API Documentation

Once the application is running, visit:
- **API Docs**: http://localhost:3000/api/docs
- **Health Check**: http://localhost:3000/api/v1

## 🧪 Testing

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test:cov

# E2E tests
npm run test:e2e
```

## 📁 Project Structure

```
src/
├── modules/
│   ├── AxonPuls-gateway/       # WebSocket gateway
│   ├── auth/               # Authentication & authorization
│   ├── event-router/       # Event routing system
│   ├── subscription-manager/ # Channel subscriptions
│   ├── message-queue/      # Redis message queuing
│   ├── connection-manager/ # Connection lifecycle
│   ├── retry-manager/      # Retry logic
│   ├── latency-tracker/    # Performance monitoring
│   └── audit-logger/       # Activity logging
├── common/                 # Shared utilities
├── config/                 # Configuration files
└── main.ts                 # Application entry point
```

## 🔧 Configuration

Key environment variables:

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_HOST`: Redis server host
- `JWT_SECRET`: JWT signing secret
- `WS_PORT`: WebSocket server port
- `NODE_ENV`: Environment (development/production)

See `.env.example` for complete configuration options.

## 📈 Monitoring

The application includes built-in monitoring for:
- Connection metrics
- Message throughput
- Latency tracking
- Error rates
- Resource usage

## 🔒 Security

- JWT-based authentication with RS256
- Multi-tenant data isolation
- Rate limiting on all endpoints
- CORS protection
- Helmet security headers
- Input validation with Zod schemas

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.
