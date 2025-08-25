# 🪝 **AXONPULS Webhook System - Production Guide**

**Status:** ✅ **PRODUCTION READY**  
**Version:** 1.0.0  
**Last Updated:** January 2025

---

## 🎯 **Overview**

The AXONPULS webhook system provides reliable event delivery to external endpoints with production-grade features including delivery guarantees, retry logic, HMAC signatures, and comprehensive error handling.

## ✅ **What's Implemented & Working**

### **🔧 Core Components**

✅ **DeliveryGuaranteeService** - Complete webhook delivery engine  
✅ **HTTP Client** - Axios-based with timeouts and retries  
✅ **HMAC Signatures** - SHA256 webhook signing for security  
✅ **Retry Logic** - Exponential backoff with jitter  
✅ **Error Handling** - Comprehensive timeout and network error handling  
✅ **Dead Letter Queue** - Failed delivery handling  
✅ **Delivery Receipts** - Complete audit trail of delivery attempts  

### **🚀 Production Features**

- **Multiple Delivery Semantics**: at-least-once, at-most-once, exactly-once
- **Configurable Retry Policies**: exponential, linear, fixed backoff strategies  
- **Timeout Management**: Per-endpoint timeout configuration
- **Signature Security**: HMAC-SHA256 signatures with configurable secrets
- **Multi-tenant Isolation**: Organization-scoped webhook endpoints
- **Comprehensive Logging**: Debug and error logging for troubleshooting
- **Real-time Monitoring**: Event emission for delivery success/failure

---

## 🚀 **Quick Start**

### **1. Basic Webhook Delivery**

```typescript
import { DeliveryGuaranteeService } from './common/services/delivery-guarantee.service';

// Define webhook endpoint
const endpoint: DeliveryEndpoint = {
  id: 'webhook-001',
  name: 'User Events Webhook',
  url: 'https://api.yourdomain.com/webhooks/users',
  method: 'POST',
  headers: {
    'X-Webhook-Secret': 'your-secret-key',
    'Authorization': 'Bearer your-token',
  },
  timeout: 30000, // 30 seconds
  retryPolicy: {
    maxRetries: 3,
    backoffStrategy: 'exponential',
    baseDelay: 1000,
    maxDelay: 30000,
    jitter: true,
  },
  semantics: 'at-least-once',
  active: true,
};

// Create event to deliver
const event: ReplayableEvent = {
  id: 'evt_user_created_123',
  eventType: 'user.created',
  channel: 'user_events',
  payload: {
    userId: 'user_456',
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Doe',
  },
  organizationId: 'org_123',
  userId: 'admin_456',
  acknowledgment: true,
  retryCount: 0,
  createdAt: new Date().toISOString(),
  metadata: {
    source: 'user_registration',
    version: '1.0',
  },
};

// Deliver the webhook
const receipt = await deliveryService.deliverEvent(event, endpoint);
console.log('Delivery Receipt:', receipt);
```

### **2. Test Webhook Delivery**

```bash
# Test with httpbin.org (useful for debugging)
npm run test:webhooks

# Test with custom endpoint
npm run test:webhooks https://your-webhook-endpoint.com/receive
```

---

## 🔧 **Configuration**

### **Endpoint Configuration**

```typescript
interface DeliveryEndpoint {
  id: string;                    // Unique endpoint identifier
  name: string;                  // Human-readable name
  url: string;                   // Target webhook URL
  method: 'POST' | 'PUT' | 'PATCH'; // HTTP method
  headers?: Record<string, string>; // Custom headers
  timeout: number;               // Request timeout in milliseconds
  retryPolicy: {
    maxRetries: number;          // Maximum retry attempts
    backoffStrategy: 'fixed' | 'exponential' | 'linear';
    baseDelay: number;           // Base delay between retries (ms)
    maxDelay: number;            // Maximum delay cap (ms)
    jitter: boolean;             // Add random jitter to delays
  };
  semantics: DeliverySemantics;  // Delivery guarantee level
  active: boolean;               // Enable/disable endpoint
}
```

### **Delivery Semantics**

- **`at-least-once`**: Guarantees delivery, may deliver duplicates
- **`at-most-once`**: No duplicates, may lose messages on failure
- **`exactly-once`**: Guarantees single delivery (uses deduplication)

### **Retry Strategies**

- **`exponential`**: Delay doubles each retry (1s, 2s, 4s, 8s...)
- **`linear`**: Delay increases linearly (1s, 2s, 3s, 4s...)
- **`fixed`**: Same delay for all retries (1s, 1s, 1s, 1s...)

---

## 🔐 **Security Features**

### **HMAC Signature Verification**

Webhooks are signed with HMAC-SHA256 signatures for security:

```typescript
// Signature is automatically added when X-Webhook-Secret header is present
headers: {
  'X-Webhook-Secret': 'your-secret-key'
}

// Signature format: sha256=<hex_digest>
// Verify on your server:
const crypto = require('crypto');
const signature = req.headers['x-webhook-signature'];
const payload = JSON.stringify(req.body);
const expectedSignature = 'sha256=' + crypto
  .createHmac('sha256', 'your-secret-key')
  .update(payload)
  .digest('hex');

if (signature === expectedSignature) {
  // Signature is valid
}
```

### **Payload Structure**

```json
{
  "event": {
    "id": "evt_user_created_123",
    "eventType": "user.created",
    "channel": "user_events",
    "payload": { "userId": "user_456", "email": "john@example.com" },
    "organizationId": "org_123",
    "userId": "admin_456",
    "acknowledgment": true,
    "retryCount": 0,
    "createdAt": "2025-01-24T10:30:00.000Z",
    "metadata": { "source": "user_registration" }
  },
  "delivery": {
    "id": "delivery_abc123",
    "attempt": 1,
    "timestamp": "2025-01-24T10:30:01.000Z"
  },
  "signature": "sha256=a1b2c3d4e5f6..."
}
```

---

## 📊 **Monitoring & Observability**

### **Event Emission**

The webhook system emits events for monitoring:

```typescript
// Listen for delivery events
eventEmitter.on('delivery.success', (data) => {
  console.log('Webhook delivered successfully:', data);
  // { receiptId, eventId, endpointId, organizationId, responseTime }
});

eventEmitter.on('delivery.failed', (data) => {
  console.log('Webhook delivery failed:', data);
  // { receiptId, eventId, endpointId, organizationId, statusCode, error }
});

eventEmitter.on('delivery.error', (data) => {
  console.log('Webhook delivery error:', data);
  // { receiptId, eventId, endpointId, organizationId, error }
});
```

### **Delivery Receipts**

Track delivery status with detailed receipts:

```typescript
interface DeliveryReceipt {
  id: string;                    // Unique receipt ID
  eventId: string;               // Source event ID
  endpointId: string;            // Target endpoint ID
  organizationId: string;        // Tenant organization
  status: 'pending' | 'delivered' | 'failed' | 'cancelled';
  attempts: number;              // Number of delivery attempts
  lastAttemptAt?: Date;          // Last attempt timestamp
  nextAttemptAt?: Date;          // Scheduled next attempt
  responseCode?: number;         // HTTP response code
  responseTime?: number;         // Response time in milliseconds
}
```

---

## 🧪 **Testing**

### **Built-in Test Script**

```bash
# Test webhook delivery to httpbin.org
npm run test:webhooks

# Test specific endpoint
npm run test:webhooks https://your-webhook.com/receive

# Test with environment variable
TEST_WEBHOOK_URL=https://your-webhook.com npm run test:webhooks
```

### **Integration Testing**

```typescript
// Example test with Jest
describe('Webhook Delivery', () => {
  it('should deliver webhook successfully', async () => {
    const mockEndpoint = {
      id: 'test-endpoint',
      url: 'https://httpbin.org/post',
      method: 'POST',
      timeout: 10000,
      retryPolicy: { maxRetries: 1, backoffStrategy: 'fixed', baseDelay: 1000, maxDelay: 5000, jitter: false },
      semantics: 'at-least-once',
      active: true,
    };
    
    const receipt = await deliveryService.deliverEvent(mockEvent, mockEndpoint);
    expect(receipt.status).toBe('delivered');
    expect(receipt.responseCode).toBe(200);
  });
});
```

---

## 🚨 **Error Handling**

### **HTTP Error Codes**

- **2xx**: Success - delivery marked as successful
- **4xx**: Client error - delivery marked as failed (no retry for most 4xx)
- **429**: Rate limited - retried with backoff
- **5xx**: Server error - retried according to retry policy

### **Network Errors**

- **Timeout**: Request exceeded configured timeout
- **Connection Error**: Network unreachable, DNS failure, etc.
- **SSL/TLS Error**: Certificate issues, protocol mismatch

### **Retry Behavior**

```typescript
// Retry logic handles these scenarios:
- HTTP 5xx server errors
- Network timeouts
- Connection failures
- Rate limiting (429)

// No retry for:
- HTTP 4xx client errors (except 429)
- Malformed URLs
- Invalid endpoint configuration
```

---

## 🔧 **Troubleshooting**

### **Common Issues**

**1. Webhook timeouts**
```bash
# Increase timeout in endpoint configuration
timeout: 30000 // 30 seconds
```

**2. SSL certificate errors**
```bash
# Add custom headers for self-signed certificates (dev only)
headers: {
  'User-Agent': 'AXONPULS-Webhook/1.0'
}
```

**3. Rate limiting**
```bash
# Configure backoff strategy
retryPolicy: {
  maxRetries: 5,
  backoffStrategy: 'exponential',
  baseDelay: 2000,
  maxDelay: 60000,
  jitter: true
}
```

### **Debug Logging**

Enable debug logging for detailed webhook information:

```bash
# Environment variable
LOG_LEVEL=debug

# Or in code
logger.debug('Webhook delivery details', { endpoint, payload });
```

---

## 📋 **Production Checklist**

✅ **HTTP Client**: Production-ready axios implementation  
✅ **Error Handling**: Comprehensive timeout and network error handling  
✅ **Retry Logic**: Exponential backoff with jitter  
✅ **Security**: HMAC-SHA256 signature verification  
✅ **Monitoring**: Event emission and delivery receipts  
✅ **Testing**: Automated test script and utilities  
✅ **Documentation**: Complete setup and usage guide  

### **Missing (Optional)**

🟡 **Admin API**: REST endpoints for webhook CRUD operations  
🟡 **Dashboard**: UI for webhook management and monitoring  
🟡 **Webhook Templates**: Pre-configured endpoint templates  

---

## 🚀 **Next Steps**

The webhook system is **production-ready** and can be used immediately for reliable event delivery. Optional enhancements include:

1. **Admin API**: REST endpoints for dynamic webhook management
2. **Dashboard UI**: Visual webhook management interface  
3. **Webhook Templates**: Common endpoint configurations
4. **Metrics Dashboard**: Real-time delivery metrics and alerts

---

**Status**: ✅ **PRODUCTION READY**  
**Critical Features**: ✅ **COMPLETE**  
**Optional Features**: 🟡 **PENDING**

The core webhook delivery system is fully functional and ready for production use!
