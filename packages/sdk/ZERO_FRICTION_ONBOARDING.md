# 🎯 Zero-Friction Onboarding

**Start using AxonPuls in 30 seconds - no JWT tokens, no registration, no complex setup!**

## 🚀 Quick Start (One Line!)

```typescript
import { createMagicClient } from '@axonstream/core';

// Just this one line!
const axon = await createMagicClient('your-email@example.com');

// Start using immediately
await axon.subscribe(['my-channel']);
await axon.publish('my-channel', { message: 'Hello World!' });
```

## 🎭 Even Simpler (Zero Config)

```typescript
import { createZeroConfigClient } from '@axonstream/core';

// Literally zero configuration
const axon = createZeroConfigClient();
await axon.connect();

// Full functionality available
await axon.subscribe(['test-channel']);
await axon.publish('test-channel', { message: 'It works!' });
```

## 🌟 Available Modes

### 1. 🎯 Magic Client (Recommended)
- **Perfect for**: New users, demos, getting started
- **Setup time**: 30 seconds
- **Features**: Full platform access for 7 days

```typescript
const axon = await createMagicClient('user@example.com');
```

### 2. 🚀 Trial Client
- **Perfect for**: Evaluating the platform
- **Setup time**: 1 minute
- **Features**: Full enterprise features for 7 days

```typescript
const axon = await createTrialClient({
    email: 'user@example.com',
    url: 'wss://your-org.axonstream.ai'
});
```

### 3. 🎭 Demo Client
- **Perfect for**: Testing, development, demos
- **Setup time**: 10 seconds
- **Features**: All features, shared demo environment

```typescript
const axon = createDemoClient();
await axon.connect();
```

### 4. 🌟 Zero Config Client
- **Perfect for**: Quick testing, proof of concepts
- **Setup time**: 5 seconds
- **Features**: Instant access, no configuration

```typescript
const axon = createZeroConfigClient();
await axon.connect();
```

## 🎭 Magic Collaboration Features

All modes include access to Magic collaboration:

```typescript
import { MagicCollaboration } from '@axonstream/core';

const axon = await createMagicClient('user@example.com');
const magic = new MagicCollaboration(axon);

// Real-time collaboration
await magic.createRoom('my-room', { content: 'Hello!' });
await magic.joinRoom('my-room', { name: 'John' });

// Time travel
await magic.timeTravel.createSnapshot('my-room', 'Initial state');

// Presence awareness
await magic.presence.joinRoom('my-room', { name: 'John', avatar: '👨‍💻' });
```

## 🌐 Production Upgrade Path

Start with trial, upgrade when ready:

```typescript
// 1. Start with trial
const trial = await createMagicClient('user@example.com');

// 2. Use all features during trial
await trial.subscribe(['my-channels']);

// 3. When ready, upgrade to production
import { createAxonPulsClient } from '@axonstream/core';

const production = createAxonPulsClient({
    url: 'wss://your-org.axonstream.ai',
    token: 'your-production-jwt-token',
    mode: 'jwt'
});
```

## 🔒 Security & Limitations

### Trial Mode Limitations:
- ✅ 7-day trial period
- ✅ Limited to 10 channels
- ✅ Max 1000 events per day
- ✅ Shared trial environment
- ✅ Rate limited to 10 requests/minute

### Demo Mode Limitations:
- ✅ Shared demo environment
- ✅ Data not persistent
- ✅ Rate limited
- ✅ Perfect for testing

### Production Features:
- 🚀 Unlimited channels and events
- 🚀 Dedicated infrastructure
- 🚀 Enterprise security
- 🚀 SLA guarantees
- 🚀 24/7 support

## 🎯 Why Zero-Friction?

**Traditional platforms:**
```typescript
// ❌ Complex setup
1. Sign up for account
2. Verify email
3. Create organization
4. Generate API keys
5. Configure authentication
6. Read 50 pages of docs
7. Finally write first line of code
```

**AxonPuls Magic Approach:**
```typescript
// ✅ One line and you're done!
const axon = await createMagicClient('user@example.com');
```

## 🚀 Backend Integration

The SDK automatically connects to these backend endpoints:

- `POST /auth/trial/access` - Request trial access
- `POST /demo/token` - Get demo token
- `GET /demo/status` - Check demo environment

No manual token management required!

## 📚 Next Steps

1. **Try it now**: `npm install @axonstream/core`
2. **Explore examples**: Check `/examples` directory
3. **Read docs**: Visit https://docs.axonstream.ai
4. **Upgrade**: Contact sales when ready for production

## 🎉 Success Stories

> "I went from never hearing about AxonPuls to having a working real-time app in under 5 minutes. The magic client is incredible!" - Developer

> "Finally, a platform that doesn't make me jump through hoops just to try it out." - CTO

> "The zero-friction onboarding converted us from skeptics to customers in one demo." - Product Manager
