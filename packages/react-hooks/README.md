# @axonstreamai/axonpuls-react

🚀 **React Hooks for AXONPULS Real-Time Platform**

The easiest way to add real-time functionality to your React apps. Built by [AxonStreamAI](https://axonstream.ai).

## 🎯 **Why Developers Love AXONPULS React Hooks**

- **3-Line Integration** - Get real-time features instantly
- **Human-in-the-Loop** - Unique differentiator no competitor has
- **TypeScript First** - Full type safety out of the box
- **Production Ready** - Battle-tested for enterprise scale

## 📦 **Installation**

```bash
npm install @axonstreamai/axonpuls-react
```

## 🚀 **Quick Start**

### Basic Connection

```tsx
import { useAxonpuls } from '@axonstreamai/axonpuls-react';

function App() {
  const axonpuls = useAxonpuls({
    apiUrl: 'wss://your-org.axonstream.ai',
    organizationId: 'your-org-id',
    token: 'your-jwt-token'
  });

  return (
    <div>
      Status: {axonpuls.isConnected ? '🟢 Connected' : '🔴 Disconnected'}
    </div>
  );
}
```

### Real-Time Chat

```tsx
import { useAxonpuls, useAxonpulsChannel } from '@axonstreamai/axonpuls-react';

function ChatRoom() {
  const axonpuls = useAxonpuls({
    apiUrl: 'wss://your-org.axonstream.ai',
    organizationId: 'your-org'
  });
  
  const chat = useAxonpulsChannel('chat:general', axonpuls);

  const sendMessage = () => {
    chat.sendMessage('chat_message', {
      text: 'Hello AXONPULS!',
      user: 'John Doe'
    });
  };

  return (
    <div>
      <div>Messages: {chat.messageCount}</div>
      {chat.messages.map(msg => (
        <div key={msg.id}>{msg.payload.text}</div>
      ))}
      <button onClick={sendMessage}>Send Message</button>
    </div>
  );
}
```

## 🎯 **Human-in-the-Loop (HITL) - Our Unique Differentiator**

Enable real-time human intervention in automated workflows:

```tsx
import { useAxonpulsHITL } from '@axonstreamai/axonpuls-react';

function ApprovalDashboard() {
  const hitl = useAxonpulsHITL(axonpuls, {
    department: 'finance',
    currentUser: { id: 'user123', name: 'John', role: 'manager' }
  });

  const handleApproval = (requestId: string, approved: boolean) => {
    hitl.submitResponse({
      requestId,
      action: approved ? 'approve' : 'reject',
      comment: approved ? 'Approved!' : 'Needs more info'
    });
  };

  return (
    <div>
      <h2>Pending Approvals ({hitl.pendingRequests.length})</h2>
      {hitl.pendingRequests.map(request => (
        <div key={request.id} className={`priority-${request.priority}`}>
          <h3>{request.title}</h3>
          <p>{request.description}</p>
          <button onClick={() => handleApproval(request.id, true)}>
            ✅ Approve
          </button>
          <button onClick={() => handleApproval(request.id, false)}>
            ❌ Reject
          </button>
        </div>
      ))}
    </div>
  );
}
```

## 👥 **Real-Time Presence**

See who's online, away, or busy:

```tsx
import { useAxonpulsPresence } from '@axonstreamai/axonpuls-react';

function TeamPresence() {
  const presence = useAxonpulsPresence(axonpuls, {
    room: 'team-dashboard',
    currentUser: { id: 'user123', name: 'John Doe' }
  });

  return (
    <div>
      <h3>Team Online ({presence.onlineCount})</h3>
      {presence.users.map(user => (
        <div key={user.id} className={`user-${user.status}`}>
          <span>{user.name}</span>
          <span className="status">{user.status}</span>
        </div>
      ))}
    </div>
  );
}
```

## 📚 **All Available Hooks**

| Hook | Purpose | Use Cases |
|------|---------|-----------|
| `useAxonpuls` | Core connection | Foundation for all real-time features |
| `useAxonpulsChannel` | Channel messaging | Chat, notifications, live updates |
| `useAxonpulsHITL` | Human-in-the-Loop | Approvals, reviews, escalations |
| `useAxonpulsPresence` | User presence | Team dashboards, collaboration |

## 🎭 **Live Examples**

Visit our [Interactive Demo](https://demo.axonstream.ai) to see all hooks in action.

## 📖 **Full Documentation**

- [Complete API Reference](https://docs.axonstream.ai/react)
- [Integration Guides](https://docs.axonstream.ai/guides)
- [Enterprise Features](https://docs.axonstream.ai/enterprise)

## 🏢 **Enterprise Ready**

- Multi-tenant isolation
- Audit logging
- Role-based access control
- 99.9% uptime SLA
- 24/7 support

## 💬 **Support**

- 📧 Email: [support@axonstream.ai](mailto:support@axonstream.ai)
- 💬 Discord: [Join our community](https://discord.gg/axonstream)
- 📚 Docs: [docs.axonstream.ai](https://docs.axonstream.ai)

---

Built with ❤️ by [AxonStreamAI](https://axonstream.ai)
