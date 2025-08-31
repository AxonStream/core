# AxonStream SDK Usage Examples

The AxonStream SDK provides a unified interface for real-time event streaming across multiple frameworks and vanilla JavaScript. Here's how to use it:

## 🚀 Installation

```bash
npm install @axonstream/core
```

This single package provides everything you need:
- Core SDK (client, events, self-healing)
- Framework adapters (React, Vue, Angular) with auto-detection
- UI components (vanilla JS + framework wrappers)
- CDN build for script tag usage

## 📦 Package Exports Structure

The SDK exports are organized as follows:

```typescript
// Main exports
import { createAxonStream, AxonPulsClient } from '@axonstream/core';

// Framework adapters (auto-detected)
import { createReactBinding } from '@axonstream/core/adapters/react';
import { createVueBinding } from '@axonstream/core/adapters/vue';
import { createAngularBinding } from '@axonstream/core/adapters/angular';

// UI components (vanilla JS)
import { AxonChat, AxonPresence, AxonHITL } from '@axonstream/core/ui';

// Embed functionality
import { AxonEmbed, mountAxonUI } from '@axonstream/core';
```

## 🌐 Vanilla JavaScript Usage

### Basic Connection & Messaging

```html
<!DOCTYPE html>
<html>
<head>
    <title>AxonStream Vanilla JS</title>
</head>
<body>
    <div id="chat-container"></div>
    <div id="presence-container"></div>
    
    <script type="module">
        import { createAxonStream, AxonChat, AxonPresence } from '@axonstream/core';
        
        // 1. Create and connect client
        const axon = await createAxonStream({ 
            org: 'my-company', 
            token: 'your-jwt-token',
            debug: true 
        });
        
        await axon.connect();
        console.log('Connected to AxonStream!');
        
        // 2. Subscribe to channels
        await axon.subscribe(['chat', 'notifications']);
        
        // 3. Listen for events
        axon.on('message', (event) => {
            console.log('Received:', event);
        });
        
        axon.on('connected', () => {
            console.log('Client connected successfully');
        });
        
        axon.on('disconnected', () => {
            console.log('Client disconnected');
        });
        
        // 4. Send messages
        await axon.publish('chat', {
            type: 'message',
            content: 'Hello from vanilla JS!',
            timestamp: Date.now()
        });
        
        // 5. Create UI components
        const chat = new AxonChat({
            container: '#chat-container',
            client: axon.client,
            channel: 'chat',
            theme: 'light'
        });
        
        const presence = new AxonPresence({
            container: '#presence-container',
            client: axon.client,
            showAvatars: true
        });
        
        // 6. Mount components
        chat.mount();
        presence.mount();
    </script>
</body>
</html>
```

### CDN Usage (No Build Step)

```html
<!DOCTYPE html>
<html>
<head>
    <title>AxonStream CDN</title>
</head>
<body>
    <div id="app"></div>
    
    <!-- Include from CDN -->
    <script src="https://unpkg.com/@axonstream/core/dist/cdn/axonstream.global.js"></script>
    
    <script>
        // Available as global AXONSTREAM
        const { createAxonStream, AxonChat } = AXONSTREAM;
        
        async function init() {
            const axon = await createAxonStream({
                org: 'my-company',
                token: 'jwt-token'
            });
            
            await axon.connect();
            
            // Create chat component
            const chat = new AxonChat({
                container: '#app',
                client: axon.client,
                channel: 'general'
            });
            
            chat.mount();
        }
        
        init().catch(console.error);
    </script>
</body>
</html>
```

### Advanced Vanilla JS Features

```javascript
import { 
    createAxonStream, 
    AxonChat, 
    AxonPresence, 
    AxonHITL,
    AxonEmbed 
} from '@axonstream/core';

// Advanced client configuration
const axon = await createAxonStream({
    org: 'my-company',
    token: 'jwt-token',
    debug: true,
    autoReconnect: true,
    maxReconnectAttempts: 5,
    reconnectInterval: 1000,
    heartbeatInterval: 30000
});

// Event replay functionality
await axon.replay({
    channel: 'chat',
    fromTimestamp: Date.now() - 86400000, // Last 24 hours
    maxEvents: 100
});

// Human-in-the-loop (HITL) integration
const hitl = new AxonHITL({
    container: '#hitl-container',
    client: axon.client,
    onEscalationRequest: (context) => {
        console.log('User needs human help:', context);
    }
});

// Embed components anywhere
const embed = new AxonEmbed({
    target: '.chat-widgets',
    components: ['chat', 'presence'],
    config: {
        theme: 'dark',
        position: 'bottom-right'
    }
});

// Circuit breaker monitoring
axon.client.on('circuitBreakerOpen', () => {
    console.log('Circuit breaker opened - experiencing issues');
});

axon.client.on('circuitBreakerHalfOpen', () => {
    console.log('Circuit breaker half-open - testing connection');
});

axon.client.on('circuitBreakerClosed', () => {
    console.log('Circuit breaker closed - connection healthy');
});
```

## ⚛️ React Usage

### Using with Create React App / Vite

```bash
npm install @axonstream/core @axonstream/react
```

```typescript
// App.tsx
import React from 'react';
import { AxonStreamProvider, useAxonStream } from '@axonstream/react';

function App() {
    return (
        <AxonStreamProvider 
            org="my-company"
            token="jwt-token"
            debug={true}
        >
            <ChatApp />
        </AxonStreamProvider>
    );
}

function ChatApp() {
    const { client, isConnected, error } = useAxonStream();
    
    if (error) {
        return <div>Error: {error.message}</div>;
    }
    
    if (!isConnected) {
        return <div>Connecting...</div>;
    }
    
    return (
        <div>
            <h1>AxonStream Chat</h1>
            <ChatComponent />
            <PresenceComponent />
        </div>
    );
}
```

### React Hooks Usage

```typescript
// ChatComponent.tsx
import React, { useState } from 'react';
import { 
    useAxonChannel, 
    useAxonPresence, 
    useAxonHITL 
} from '@axonstream/react';

export function ChatComponent() {
    const [message, setMessage] = useState('');
    
    // Channel hook for messaging
    const { 
        messages, 
        sendMessage, 
        isLoading,
        error 
    } = useAxonChannel('chat');
    
    // Presence hook for user awareness
    const { 
        users, 
        currentUser,
        updatePresence 
    } = useAxonPresence({
        showTyping: true,
        trackActivity: true
    });
    
    // HITL hook for human escalation
    const {
        escalateToHuman,
        isHumanAvailable,
        requestStatus
    } = useAxonHITL();
    
    const handleSendMessage = async () => {
        if (!message.trim()) return;
        
        await sendMessage({
            content: message,
            type: 'text',
            metadata: {
                timestamp: Date.now(),
                userId: currentUser?.id
            }
        });
        
        setMessage('');
    };
    
    const handleNeedHelp = async () => {
        await escalateToHuman({
            reason: 'user_requested',
            context: {
                currentConversation: messages.slice(-5),
                userFrustration: 'high'
            }
        });
    };
    
    return (
        <div className="chat-container">
            {/* Messages */}
            <div className="messages">
                {messages.map((msg) => (
                    <div key={msg.id} className="message">
                        <strong>{msg.user}:</strong> {msg.content}
                        <small>{new Date(msg.timestamp).toLocaleTimeString()}</small>
                    </div>
                ))}
                {isLoading && <div>Loading messages...</div>}
                {error && <div>Error: {error.message}</div>}
            </div>
            
            {/* Presence */}
            <div className="presence">
                <h4>Online Users ({users.length})</h4>
                {users.map((user) => (
                    <span key={user.id} className="user">
                        {user.name} {user.isTyping && '(typing...)'}
                    </span>
                ))}
            </div>
            
            {/* Message Input */}
            <div className="input-area">
                <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Type a message..."
                />
                <button onClick={handleSendMessage}>Send</button>
                
                {isHumanAvailable && (
                    <button onClick={handleNeedHelp}>
                        Need Human Help
                    </button>
                )}
            </div>
            
            {requestStatus === 'pending' && (
                <div className="hitl-status">
                    Connecting you to a human agent...
                </div>
            )}
        </div>
    );
}
```

### Advanced React Patterns

```typescript
// useAxonStreamAdvanced.tsx
import { useEffect, useCallback } from 'react';
import { useAxonStream } from '@axonstream/react';

export function useAxonStreamAdvanced() {
    const { client, isConnected } = useAxonStream();
    
    // Set up event replay on component mount
    useEffect(() => {
        if (!isConnected || !client) return;
        
        const setupReplay = async () => {
            await client.replay({
                channel: 'notifications',
                fromTimestamp: Date.now() - 3600000, // Last hour
                deliveryGuarantee: 'at-least-once'
            });
        };
        
        setupReplay().catch(console.error);
    }, [isConnected, client]);
    
    // Monitor self-healing events
    useEffect(() => {
        if (!client) return;
        
        const handleCircuitBreaker = (state: string) => {
            console.log(`Circuit breaker state: ${state}`);
            // Show user notification about connection issues
        };
        
        client.on('circuitBreakerOpen', () => handleCircuitBreaker('open'));
        client.on('circuitBreakerClosed', () => handleCircuitBreaker('closed'));
        
        return () => {
            client.off('circuitBreakerOpen', handleCircuitBreaker);
            client.off('circuitBreakerClosed', handleCircuitBreaker);
        };
    }, [client]);
    
    // Batch message publishing
    const publishBatch = useCallback(async (messages: any[]) => {
        if (!client) return;
        
        const batch = messages.map(msg => ({
            channel: msg.channel,
            data: {
                type: msg.type,
                payload: msg.payload,
                timestamp: Date.now()
            }
        }));
        
        await client.publishBatch(batch);
    }, [client]);
    
    return {
        publishBatch,
        client,
        isConnected
    };
}
```

## 🔧 Framework Auto-Detection

The SDK automatically detects your framework and provides the appropriate bindings:

```typescript
// This works in any environment
import { createAxonStreamWithFramework } from '@axonstream/core';

// Auto-detects React/Vue/Angular and returns framework-specific API
const axon = await createAxonStreamWithFramework({
    org: 'my-company',
    token: 'jwt-token'
});

// In React: returns hooks and components
// In Vue: returns composables and components  
// In Angular: returns services and components
// In vanilla JS: returns standard API
```

## 🎨 UI Components

All UI components work across frameworks:

```typescript
// Vanilla JS
import { AxonChat, AxonPresence } from '@axonstream/core/ui';

// React
import { AxonChatReact, AxonPresenceReact } from '@axonstream/react';

// Vue  
import { AxonChatVue, AxonPresenceVue } from '@axonstream/vue';

// Angular
import { AxonChatComponent, AxonPresenceComponent } from '@axonstream/angular';
```

## 🔒 Self-Healing Features

The SDK includes automatic self-healing capabilities:

- **Circuit Breaker**: Prevents cascade failures
- **Exponential Backoff**: Smart reconnection strategy
- **Heartbeat Monitoring**: Detects connection health
- **Auto-Reconnection**: Seamless reconnection on network issues
- **Event Replay**: Recover missed events after reconnection
- **Dead Letter Queue**: Handle failed message delivery

## 🚀 Production Features

- **Multi-tenancy**: Isolated environments per organization
- **Event Replay**: Historical event recovery with guarantees
- **Monitoring**: Built-in Prometheus metrics
- **Security**: JWT-based authentication with refresh
- **Scalability**: Redis Streams for horizontal scaling
- **Dependency Flexibility**: Peer dependencies for version compatibility

## 📱 Embed Anywhere

```html
<!-- Single line embed -->
<script src="https://unpkg.com/@axonstream/core/dist/embed/embed.global.js" 
        data-org="my-company" 
        data-token="jwt-token"
        data-components="chat,presence">
</script>

<!-- Programmatic embed -->
<script type="module">
    import { mountAxonUI } from '@axonstream/core';
    
    mountAxonUI({
        org: 'my-company',
        token: 'jwt-token',
        target: '#my-app',
        components: ['chat', 'presence', 'hitl']
    });
</script>
```

This SDK provides a complete real-time streaming solution with production-grade self-healing, multi-framework support, and comprehensive UI components - all in a single package.
