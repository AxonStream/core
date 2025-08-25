# @axonstream/core

🚀 **ONE PACKAGE FOR EVERYTHING** 

The complete AxonStream real-time platform in a single package. Built by [AxonStream AI](https://axonstream.ai).

## 🎯 **ONE COMMAND ALL DONE**

```bash
npm install @axonstream/core
```

## 🔭 **FOUR WAYS TO USE AXONSTREAM**

### 1. **NPM (apps):** One import provides everything

```typescript
import { createAxonStream } from '@axonstream/core';

// ONE COMMAND - ALL DONE
const axon = await createAxonStream({
  org: 'your-org',
  token: 'your-jwt-token'
});

// Everything is ready
await axon.connect();
```

### 2. **CDN (websites, no build):** Global AxonSDK + AXONUI

```html
<script src="https://cdn.axonstream.ai/axonui.min.js"></script>
<script>
  // Everything is globally available
  const axon = new window.AxonSDK({ 
    url: 'wss://your-org.axonstream.ai',
    token: 'your-jwt-token'
  });
  await axon.connect();
</script>
```

### 3. **HTTP API (servers/no SDK):** Call endpoints directly

```bash
curl -X POST "https://api.axonstream.ai/v1/events" \
  -H "Authorization: Bearer jwt-token" \
  -d '{"channel": "test", "data": {"hello": "world"}}'
```

### 4. **Single embed:** AXONUI.mount() - that's it!

```html
<div id="axon-app"></div>
<script src="https://cdn.axonstream.ai/axonui.min.js"></script>
<script>
  AXONUI.mount({
    el: '#axon-app',
    token: 'your-jwt-token',
    channel: 'chat-room',
    org: 'your-org'
  });
</script>
```

## 📦 **What's Included**

- ✅ **Core SDK** - Connect, subscribe, publish, replay
- ✅ **Multi-Tenant** - Org isolation, RBAC, JWT RS256
- ✅ **Self-Healing** - Auto-reconnect, retry, circuit breaker
- ✅ **Embed Helper** - One-line embed anywhere  
- ✅ **CDN Build** - Global window access
- ✅ **TypeScript** - Full type safety
- ✅ **React Hooks** - Auto-detected and lazy-loaded
- ✅ **Vue Composables** - Auto-detected and lazy-loaded  
- ✅ **Angular Services** - Auto-detected and lazy-loaded
- ✅ **UI Components** - Complete AXONUI component system
- ✅ **Framework Adapters** - Zero-config framework detection

## 🎨 **Quick Start Examples**

### Real-time Chat

```typescript
import { AxonPulsClient } from '@axonstream/core';

const client = new AxonPulsClient({
  url: 'wss://your-org.axonstream.ai',
  token: 'your-jwt-token'
});

await client.connect();
await client.subscribe(['org:your-org:chat:general']);

client.on('event', (event) => {
  console.log('New message:', event.payload);
});

// Send a message
await client.publish('org:your-org:chat:general', {
  type: 'chat_message',
  payload: { text: 'Hello AXONPULS!', user: 'John' }
});
```

### Simple Embed

```html
<!DOCTYPE html>
<html>
<head>
  <title>AXONPULS Live Demo</title>
</head>
<body>
  <h1>My App with Real-time Features</h1>
  <div id="live-chat"></div>
  
  <script src="https://cdn.axonstream.ai/axonui.min.js"></script>
  <script>
    AXONUI.mount({
      el: '#live-chat',
      token: 'your-jwt-token',
      channel: 'org:your-org:support',
      theme: 'dark'
    });
  </script>
</body>
</html>
```

## 🛡️ **Security & Multi-Tenancy**

- RS256 JWT with org_id isolation
- Channel prefix enforcement (`org:your-org:*`)
- Role-based access control
- Rate limiting per organization
- CSRF/CORS protection

## 🔧 **Development**

```bash
# Build everything
npm run build

# Individual builds
npm run build:sdk     # Core SDK
npm run build:cdn     # Global window build  
npm run build:embed   # Embed helper

# Development
npm run dev           # Watch mode
```

## 📊 **Size Budgets**

- **Core SDK:** ~45 KB (min+gz) - Full featured client
- **CDN/IIFE:** ~75 KB (min+gz) - Includes embed UI
- **Embed only:** ~25 KB (min+gz) - Basic chat interface

## 🎯 **Framework Integration Examples**

### React with Hooks

```tsx
import { createAxonStream } from '@axonstream/core';
import { useEffect, useState } from 'react';

function App() {
  const [axon, setAxon] = useState(null);

  useEffect(() => {
    const initAxon = async () => {
      const client = await createAxonStream({
        org: 'my-org',
        token: 'jwt-token'
      });
      
      await client.connect();
      setAxon(client);
    };
    
    initAxon();
  }, []);

  if (!axon) return <div>Connecting...</div>;

  return (
    <div>
      <h1>Real-time App</h1>
      {/* Framework adapter auto-detects React and provides hooks */}
      <ChatComponent axon={axon} />
    </div>
  );
}

function ChatComponent({ axon }) {
  // Framework adapter provides React hooks automatically
  const { ui } = axon;
  
  useEffect(() => {
    // Render chat component
    ui.render('#chat-container', 'chat', {
      channel: 'general',
      theme: 'dark'
    });
  }, []);

  return <div id="chat-container" />;
}
```

### Vue with Composables

```vue
<template>
  <div>
    <h1>Real-time App</h1>
    <div ref="chatContainer" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { createAxonStream } from '@axonstream/core';

const chatContainer = ref(null);

onMounted(async () => {
  const axon = await createAxonStream({
    org: 'my-org', 
    token: 'jwt-token'
  });
  
  await axon.connect();
  
  // Framework adapter auto-detects Vue and provides composables
  axon.ui.render(chatContainer.value, 'presence', {
    room: 'team-room',
    currentUser: { id: '1', name: 'John' }
  });
});
</script>
```

### Angular with Services

```typescript
import { Component, OnInit } from '@angular/core';
import { createAxonStream } from '@axonstream/core';

@Component({
  selector: 'app-root',
  template: `
    <h1>Real-time App</h1>
    <div #hitlContainer></div>
  `
})
export class AppComponent implements OnInit {
  async ngOnInit() {
    const axon = await createAxonStream({
      org: 'my-org',
      token: 'jwt-token'  
    });
    
    await axon.connect();
    
    // Framework adapter auto-detects Angular and provides services
    axon.ui.render('#hitlContainer', 'hitl', {
      department: 'finance',
      currentUser: { id: '1', name: 'Manager', role: 'approver' }
    });
  }
}
```

## 🚀 **AXONUI Component System**

### Complete Widget Builder

```typescript
import { createAxonStream, AxonUIBuilder } from '@axonstream/core';

const axon = await createAxonStream({ org: 'my-org', token: 'jwt-token' });
await axon.connect();

// Build a complete real-time dashboard
const ui = axon.ui.builder()
  .chat({ channel: 'support', theme: 'dark' })
  .presence({ room: 'office', currentUser: { id: '1', name: 'John' } })
  .hitl({ department: 'finance', showPriority: true })
  .notifications({ position: 'top-right', enableSound: true })
  .mount('#dashboard');

// Individual components
const chat = ui.chat;
const presence = ui.presence;
const hitl = ui.hitl;
```

### CDN Usage with Full Features

```html
<!DOCTYPE html>
<html>
<head>
  <title>AXONPULS Dashboard</title>
  <script src="https://cdn.axonstream.ai/axonui.min.js"></script>
</head>
<body>
  <h1>Real-time Dashboard</h1>
  <div id="dashboard"></div>
  
  <script>
    // Everything available globally
    const client = new window.AxonSDK({
      url: 'wss://my-org.axonstream.ai',
      token: 'jwt-token'
    });
    
    client.connect().then(() => {
      // Build complete UI
      const ui = window.AXONUI.builder(client)
        .chat({ channel: 'general' })
        .presence({ room: 'team' })
        .hitl({ department: 'support' })
        .mount('#dashboard');
        
      // Or individual components
      window.AXONUI.createChat({
        client,
        channel: 'support',
        theme: 'dark'
      }).mount('#chat');
    });
  </script>
</body>
</html>
```

### Framework Auto-Detection

```javascript
// Automatically detects your framework and provides appropriate bindings
import { detectFramework, createFrameworkBinding } from '@axonstream/core';

const framework = detectFramework();
console.log(framework); // { framework: 'react', version: '18.2.0' }

const client = new AxonPulsClient({ url: 'ws://localhost:3001', token: 'jwt' });
const binding = await createFrameworkBinding(client);

// `binding` now contains framework-specific hooks/composables/services
```

## 📝 **API Reference**

### Core Client

```typescript
import { AxonPulsClient } from '@axonstream/core';

const client = new AxonPulsClient({
  url: string;           // WebSocket URL
  token: string;         // JWT token
  autoReconnect?: boolean;  // Default: true
  debug?: boolean;       // Default: false
});

// Methods
await client.connect();
await client.disconnect();
await client.subscribe(channels: string[]);
await client.unsubscribe(channels: string[]);
await client.publish(channel: string, event: object);

// Events
client.on('connected', () => {});
client.on('disconnected', () => {});
client.on('event', (event) => {});
client.on('error', (error) => {});
```

### Embed Helper

```typescript
import { mountAxonUI } from '@axonstream/core';

const instance = await mountAxonUI({
  el: string | HTMLElement;     // Target element
  token: string;                // JWT token  
  channel: string;              // Channel to subscribe
  org?: string;                 // Organization (optional)
  theme?: 'light' | 'dark' | 'auto'; // UI theme
});

// Methods
instance.disconnect();
instance.send(data);
instance.on(event, handler);
```

## 🆘 **Support**

- 📧 **Email:** info@axonstream.ai
- 🌐 **Website:** https://axonstream.ai
- 📚 **Docs:** https://docs.axonstream.ai

---

**Built with ❤️ by AxonStream AI**
