# Enterprise Procurement Demo

## Overview
This demo showcases AxonStream's capabilities in a real-time procurement system:

- **Real-time vendor performance monitoring**
- **Live notifications and alerts**
- **Collaborative approval workflows**
- **Smart vendor recommendations**

## Features Demonstrated
✅ Real-time WebSocket connections  
✅ Multi-channel subscriptions  
✅ Bidirectional communication  
✅ Live dashboard updates  
✅ Enterprise-grade notifications  

## Running the Demo

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set environment variables:
   ```bash
   export REACT_APP_AXONSTREAM_URL="ws://localhost:3000"
   export REACT_APP_JWT_TOKEN="your-jwt-token"
   export AXONSTREAM_URL="ws://localhost:3000"
   export AXONSTREAM_TOKEN="your-jwt-token"
   ```

3. Run the demo:
   ```bash
   npm run demo
   ```

This will start both the simulator (backend) and the React dashboard (frontend).

## Business Value Demonstrated

### 1. Real-Time Decision Making
- Instant vendor performance updates
- Live alerts for critical events
- Real-time approval workflows

### 2. Collaborative Procurement
- Multi-user approval processes
- Shared vendor insights
- Team notifications

### 3. Data-Driven Recommendations
- Smart vendor selection
- Performance-based scoring
- Automated alerts

## Technical Features Showcased

### WebSocket Infrastructure
- High-performance real-time connections
- Auto-reconnection and error handling
- Efficient message routing

### Enterprise Security
- JWT-based authentication
- Multi-tenant isolation
- Secure message delivery

### Developer Experience
- Simple API integration
- React hooks support
- Minimal setup required

---

**This demo proves AxonStream can handle enterprise-grade procurement workflows with real-time collaboration and decision-making capabilities.**
