# AxonStream Platform - Test Results

**Generated:** 2025-08-31T13:44:00.945Z  
**Status:** ⚠️ ISSUES DETECTED  
**Pass Rate:** 66.7% (2/3)  
**Duration:** 125ms  

## 📊 Test Summary

| Category | Passed | Failed | Total |
|----------|--------|--------|-------|
| core | 2 | 1 | 3 |
| performance | 0 | 0 | 0 |
| security | 0 | 0 | 0 |
| enterprise | 0 | 0 | 0 |
| scalability | 0 | 0 | 0 |
| reliability | 0 | 0 | 0 |

## 🏆 Performance Benchmarks


### Connection Performance
- **Average Connection Time:** undefinedms
- **P95 Connection Time:** undefinedms

### Message Latency
- **Average Latency:** undefinedms  
- **P95 Latency:** undefinedms

### Throughput
- **Messages per Second:** undefined
- **Received per Second:** undefined

### Competitor Comparison
| Platform | Connection Time | Latency | Throughput |
|----------|----------------|---------|------------|
| Pusher | ~200ms | ~100ms | 10K msg/s |
| Ably | ~150ms | ~80ms | 15K msg/s |
| **AxonStream** | **undefinedms** | **undefinedms** | **undefined msg/s** |


## 🔍 Detailed Test Results


### CORE


- **WebSocket Connection**: ✅ PASSED (63ms)


- **SDK Initialization**: ✅ PASSED (45ms)


- **REST API Endpoints**: ❌ FAILED (11ms)
  - Error: API endpoints failed: [
  {
    "endpoint": "/health",
    "status": 404,
    "expected": 200,
    "passed": false,
    "responseTime": "N/A"
  },
  {
    "endpoint": "/api/v1/health",
    "status": 404,
    "expected": 200,
    "passed": false,
    "responseTime": "N/A"
  },
  {
    "endpoint": "/metrics",
    "status": 404,
    "expected": 200,
    "passed": false,
    "responseTime": "N/A"
  }
]


### PERFORMANCE



### SECURITY



### ENTERPRISE



### SCALABILITY



### RELIABILITY




---

**AxonStream Platform Production Readiness Validation**  
*This report validates enterprise-grade capabilities and performance benchmarks*
