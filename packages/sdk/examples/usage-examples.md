# AxonStream SDK Usage Examples

## Framework Adapters and UI Components

### 1. Auto-Detection Example

```typescript
import { createAxonStream, detectFramework } from '@axonstream/core';

// Framework is auto-detected
const framework = detectFramework();
console.log(framework); // { framework: 'react', version: '18.2.0' }

const axon = await createAxonStream({
  org: 'my-org',
  token: 'jwt-token'
});

await axon.connect();

// UI components automatically adapt to your framework
const chat = axon.ui.chat({
  channel: 'general',
  theme: 'dark'
});

chat.mount('#chat-container');
```

### 2. React Example

```tsx
import { createAxonStream } from '@axonstream/core';
import { useEffect, useState } from 'react';

function ChatApp() {
  const [axon, setAxon] = useState(null);

  useEffect(() => {
    const init = async () => {
      const client = await createAxonStream({
        org: 'my-org',
        token: 'jwt-token'
      });
      
      await client.connect();
      setAxon(client);
    };
    
    init();
  }, []);

  useEffect(() => {
    if (axon) {
      // Render complete real-time dashboard
      const ui = axon.ui.builder()
        .chat({ channel: 'support', theme: 'dark' })
        .presence({ room: 'office', currentUser: { id: '1', name: 'John' } })
        .hitl({ department: 'finance', showPriority: true })
        .mount('#dashboard');
    }
  }, [axon]);

  return (
    <div>
      <h1>Real-time Dashboard</h1>
      <div id="dashboard" />
    </div>
  );
}
```

### 3. Vue Example

```vue
<template>
  <div>
    <h1>Real-time App</h1>
    <div ref="dashboardRef" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { createAxonStream } from '@axonstream/core';

const dashboardRef = ref(null);

onMounted(async () => {
  const axon = await createAxonStream({
    org: 'my-org',
    token: 'jwt-token'
  });
  
  await axon.connect();
  
  // Build complete UI with multiple components
  axon.ui.builder()
    .chat({ channel: 'general', enableInput: true })
    .presence({ room: 'team-room' })
    .notifications({ position: 'top-right', enableSound: true })
    .mount(dashboardRef.value);
});
</script>
```

### 4. Angular Example

```typescript
import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { createAxonStream } from '@axonstream/core';

@Component({
  selector: 'app-dashboard',
  template: `
    <h1>Real-time Dashboard</h1>
    <div #dashboard></div>
  `
})
export class DashboardComponent implements OnInit {
  @ViewChild('dashboard') dashboardEl!: ElementRef;

  async ngOnInit() {
    const axon = await createAxonStream({
      org: 'my-org',
      token: 'jwt-token'
    });
    
    await axon.connect();
    
    // Angular adapter provides services automatically
    axon.ui.builder()
      .hitl({ 
        department: 'approvals',
        currentUser: { id: '1', name: 'Manager', role: 'approver' }
      })
      .chat({ channel: 'support' })
      .mount(this.dashboardEl.nativeElement);
  }
}
```

### 5. CDN Usage (No Build Required)

```html
<!DOCTYPE html>
<html>
<head>
  <title>Real-time Dashboard</title>
  <script src="https://cdn.axonstream.ai/axonui.min.js"></script>
</head>
<body>
  <div id="app">
    <h1>Live Dashboard</h1>
    <div id="chat"></div>
    <div id="presence"></div>
    <div id="hitl"></div>
  </div>

  <script>
    // Everything available globally
    const client = new window.AxonSDK({
      url: 'wss://my-org.axonstream.ai',
      token: 'jwt-token'
    });
    
    client.connect().then(() => {
      // Individual components
      window.AXONUI.createChat({
        client,
        channel: 'support',
        theme: 'dark'
      }).mount('#chat');
      
      window.AXONUI.createPresence({
        client,
        room: 'team',
        currentUser: { id: '1', name: 'John' }
      }).mount('#presence');
      
      window.AXONUI.createHITL({
        client,
        department: 'finance'
      }).mount('#hitl');
      
      // Or use the builder
      const ui = window.AXONUI.builder(client)
        .notifications({ position: 'bottom-right' })
        .mount('#notifications');
    });
  </script>
</body>
</html>
```

### 6. One-Line Embed

```html
<!-- Single line embedding -->
<div id="live-chat"></div>
<script src="https://cdn.axonstream.ai/axonui.min.js"></script>
<script>
  AXONUI.mount({
    el: '#live-chat',
    token: 'jwt-token',
    channel: 'support',
    org: 'my-org',
    theme: 'auto',
    features: ['chat', 'presence']
  });
</script>
```

## Component Features

### Chat Component
- Real-time messaging
- Message history and replay
- Custom themes
- Typing indicators
- File attachments (via payload)

### Presence Component  
- Live user tracking
- Status indicators (online/away/busy)
- Avatar support
- Room-based presence

### HITL (Human-in-the-Loop) Component
- Approval workflows
- Priority-based queuing
- Real-time notifications
- Response tracking
- Escalation handling

### Notifications Component
- Toast notifications
- Persistent notification center
- Priority-based display
- Sound alerts
- Custom actions

### Embed Component
- Multiple feature combinations
- Tabbed interface
- Responsive design
- Minimizable UI
- Theme customization

## Advanced Usage

### Custom Themes

```typescript
import { themes, getTheme } from '@axonstream/core';

// Use built-in themes
const chat = axon.ui.chat({
  channel: 'general',
  theme: 'dark' // 'light', 'dark', 'auto'
});

// Or define custom theme
const customTheme = {
  ...themes.dark,
  primary: '#ff6b35',
  success: '#4ecdc4'
};

const presence = axon.ui.presence({
  room: 'team',
  theme: 'custom',
  style: {
    '--primary': customTheme.primary,
    '--success': customTheme.success
  }
});
```

### Event Handling

```typescript
const axon = await createAxonStream({ org: 'my-org', token: 'jwt' });
await axon.connect();

// Listen to all events
axon.on('event', (event) => {
  console.log('Received:', event);
});

// Component-specific events
const chat = axon.ui.chat({ channel: 'general' });
chat.on('message_sent', (data) => {
  console.log('Message sent:', data);
});

const hitl = axon.ui.hitl({ department: 'finance' });
hitl.on('request_approved', (data) => {
  console.log('Request approved:', data);
});
```

### Framework Detection API

```typescript
import { 
  detectFramework, 
  detectReact, 
  detectVue, 
  detectAngular,
  createFrameworkBinding 
} from '@axonstream/core';

// Manual detection
if (detectReact()) {
  console.log('React detected!');
}

// Auto-detection with version
const framework = detectFramework();
if (framework) {
  console.log(`${framework.framework} v${framework.version} detected`);
  
  // Create framework-specific bindings
  const binding = await createFrameworkBinding(client);
  // binding now contains hooks/composables/services
}
```

## Size Information

- **Core SDK:** ~45 KB (min+gz) - Full featured client
- **With Framework Adapters:** ~65 KB (min+gz) - Includes React/Vue/Angular
- **With UI Components:** ~85 KB (min+gz) - Complete AXONUI system
- **CDN Build:** ~95 KB (min+gz) - Everything included
- **Individual Components:** ~15-25 KB each

## Browser Support

- Chrome 70+
- Firefox 65+
- Safari 12+
- Edge 79+
- Mobile Safari 12+
- Chrome Mobile 70+

## Framework Support

- **React:** 16.8+ (hooks support)
- **Vue:** 2.6+ and 3.0+
- **Angular:** 12.0+
- **Vanilla JS:** All modern browsers

## TypeScript Support

Full TypeScript support with auto-completion:

```typescript
import type { 
  ChatConfig, 
  PresenceConfig, 
  HITLConfig,
  AxonPulsClient,
  AxonPulsEvent 
} from '@axonstream/core';

const config: ChatConfig = {
  channel: 'general',
  client: myClient,
  theme: 'dark',
  enableInput: true
};
```
