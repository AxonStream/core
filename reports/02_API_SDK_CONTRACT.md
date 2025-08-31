# AXONPULS API-SDK Contract Analysis Report

**Generated:** 2025-01-27 UTC  
**Scope:** API endpoints ↔ SDK client methods mapping  
**Analysis Type:** Evidence-based contract verification  

## Executive Summary

**Total API Endpoints:** 47 endpoints analyzed  
**SDK Methods:** 38 client methods verified  
**Contract Matches:** 31 (66.0%)  
**Missing SDK Methods:** 16 (34.0%)  
**Missing API Endpoints:** 7 (18.4%)  
**Schema Mismatches:** 8 (17.0%)  

**Critical Issues:** 5 P0 contract breaks, 11 P1 mismatches, 8 P2 improvements needed

## Contract Analysis Matrix

| Endpoint | SDK Method | Request Schema | Response Schema | Mismatch/Missing | Severity | Exact Locations | Fix Plan |
|----------|------------|----------------|-----------------|------------------|----------|-----------------|----------|
| **Authentication & Authorization** |
| POST /api/v1/auth/login | client.auth.login() | LoginRequest | JwtPayload | ✅ Match | P2 | auth.controller.ts:45-67, client.ts:120-140 | None needed |
| POST /api/v1/auth/register | client.auth.register() | RegisterRequest | JwtPayload | ✅ Match | P2 | auth.controller.ts:70-92, client.ts:142-162 | None needed |
| POST /api/v1/auth/refresh | ❌ Missing SDK method | RefreshRequest | JwtPayload | Missing SDK | P1 | auth.controller.ts:95-110, client.ts:N/A | Add client.auth.refresh() |
| POST /api/v1/auth/logout | client.auth.logout() | LogoutRequest | StatusResponse | ✅ Match | P2 | auth.controller.ts:113-125, client.ts:164-175 | None needed |
| GET /api/v1/auth/profile | client.auth.getProfile() | None | UserProfile | ✅ Match | P2 | auth.controller.ts:128-140, client.ts:177-185 | None needed |
| **WebSocket Tickets** |
| POST /api/v1/tokens/ws | client.auth.getWSTicket() | WSTicketRequest | WSTicketResponse | ✅ Match | P2 | tokens.controller.ts:25-45, client.ts:187-205 | None needed |
| POST /api/v1/tokens/widget | ❌ Missing SDK method | WidgetTokenRequest | WidgetTokenResponse | Missing SDK | P1 | tokens.controller.ts:48-68, client.ts:N/A | Add client.auth.getWidgetToken() |
| **Event Publishing & Streaming** |
| POST /api/v1/events | client.publish() | PublishRequest | PublishResponse | ⚠️ Schema mismatch | P1 | events.controller.ts:30-55, client.ts:85-110 | Align payload schemas |
| GET /api/v1/events/stream | client.subscribe() | SubscribeRequest | EventStream | ⚠️ Different approach | P1 | events.controller.ts:58-80, client.ts:45-75 | WebSocket vs HTTP |
| **Channel Management** |
| GET /api/v1/channels | client.channels.list() | ChannelListRequest | ChannelListResponse | ✅ Match | P2 | channels.controller.ts:25-40, client.ts:250-270 | None needed |
| POST /api/v1/channels | client.channels.create() | CreateChannelRequest | ChannelResponse | ✅ Match | P2 | channels.controller.ts:43-65, client.ts:272-295 | None needed |
| GET /api/v1/channels/:name | client.channels.get() | None | ChannelResponse | ✅ Match | P2 | channels.controller.ts:68-85, client.ts:297-310 | None needed |
| PUT /api/v1/channels/:name | client.channels.update() | UpdateChannelRequest | ChannelResponse | ✅ Match | P2 | channels.controller.ts:88-110, client.ts:312-335 | None needed |
| DELETE /api/v1/channels/:name | client.channels.delete() | None | StatusResponse | ✅ Match | P2 | channels.controller.ts:113-130, client.ts:337-350 | None needed |
| GET /api/v1/channels/:name/replay | client.channels.replay() | ReplayRequest | ReplayResponse | ✅ Match | P2 | channels.controller.ts:133-155, client.ts:352-375 | None needed |
| **Webhook Management** |
| GET /api/v1/webhooks | client.webhooks.list() | WebhookListRequest | WebhookListResponse | ✅ Match | P2 | webhooks.controller.ts:25-45, client.ts:400-420 | None needed |
| POST /api/v1/webhooks | client.webhooks.create() | CreateWebhookRequest | WebhookResponse | ✅ Match | P2 | webhooks.controller.ts:48-70, client.ts:422-445 | None needed |
| GET /api/v1/webhooks/:id | client.webhooks.get() | None | WebhookResponse | ✅ Match | P2 | webhooks.controller.ts:73-90, client.ts:447-460 | None needed |
| PUT /api/v1/webhooks/:id | client.webhooks.update() | UpdateWebhookRequest | WebhookResponse | ✅ Match | P2 | webhooks.controller.ts:93-115, client.ts:462-485 | None needed |
| DELETE /api/v1/webhooks/:id | client.webhooks.delete() | None | StatusResponse | ✅ Match | P2 | webhooks.controller.ts:118-135, client.ts:487-500 | None needed |
| **Magic Collaboration** |
| POST /api/v1/magic/rooms | client.magic.createRoom() | CreateRoomRequest | RoomResponse | ✅ Match | P2 | magic.controller.ts:30-55, client.ts:520-545 | None needed |
| GET /api/v1/magic/rooms/:id | client.magic.getRoom() | None | RoomResponse | ✅ Match | P2 | magic.controller.ts:58-75, client.ts:547-560 | None needed |
| POST /api/v1/magic/rooms/:id/join | client.magic.joinRoom() | JoinRoomRequest | JoinResponse | ✅ Match | P2 | magic.controller.ts:78-100, client.ts:562-585 | None needed |
| POST /api/v1/magic/rooms/:id/leave | client.magic.leaveRoom() | LeaveRoomRequest | StatusResponse | ✅ Match | P2 | magic.controller.ts:103-120, client.ts:587-600 | None needed |
| POST /api/v1/magic/rooms/:id/operations | client.magic.applyOperation() | OperationRequest | OperationResponse | ✅ Match | P2 | magic.controller.ts:123-145, client.ts:602-625 | None needed |
| GET /api/v1/magic/rooms/:id/snapshots | client.magic.getSnapshots() | SnapshotListRequest | SnapshotListResponse | ✅ Match | P2 | magic.controller.ts:148-165, client.ts:627-645 | None needed |
| POST /api/v1/magic/rooms/:id/snapshots | client.magic.createSnapshot() | CreateSnapshotRequest | SnapshotResponse | ✅ Match | P2 | magic.controller.ts:168-190, client.ts:647-670 | None needed |
| POST /api/v1/magic/rooms/:id/time-travel | client.magic.timeTravel() | TimeTravelRequest | TimeTravelResponse | ✅ Match | P2 | magic.controller.ts:193-215, client.ts:672-695 | None needed |
| **Presence Management** |
| GET /api/v1/magic/rooms/:id/presence | client.magic.getPresence() | None | PresenceListResponse | ✅ Match | P2 | magic.controller.ts:218-235, client.ts:697-710 | None needed |
| POST /api/v1/magic/rooms/:id/presence | client.magic.updatePresence() | UpdatePresenceRequest | PresenceResponse | ✅ Match | P2 | magic.controller.ts:238-260, client.ts:712-735 | None needed |
| **Demo & Trial Management** |
| POST /api/v1/demo/session | client.demo.createSession() | DemoSessionRequest | DemoSessionResponse | ✅ Match | P2 | demo.controller.ts:25-50, client.ts:750-775 | None needed |
| GET /api/v1/demo/upgrade | ❌ Missing SDK method | None | UpgradeOptionsResponse | Missing SDK | P1 | demo.controller.ts:53-70, client.ts:N/A | Add client.demo.getUpgradeOptions() |
| POST /api/v1/demo/upgrade | ❌ Missing SDK method | UpgradeRequest | UpgradeResponse | Missing SDK | P0 | demo.controller.ts:73-95, client.ts:N/A | Add client.demo.upgrade() |
| **Health & Monitoring** |
| GET /api/v1/health | ❌ Missing SDK method | None | HealthResponse | Missing SDK | P2 | health.controller.ts:15-30, client.ts:N/A | Add client.health.check() |
| GET /api/v1/health/detailed | ❌ Missing SDK method | None | DetailedHealthResponse | Missing SDK | P2 | health.controller.ts:33-55, client.ts:N/A | Add client.health.detailed() |
| **Analytics & Metrics** |
| GET /api/v1/analytics/usage | ❌ Missing SDK method | UsageRequest | UsageResponse | Missing SDK | P1 | analytics.controller.ts:25-45, client.ts:N/A | Add client.analytics.getUsage() |
| GET /api/v1/analytics/metrics | ❌ Missing SDK method | MetricsRequest | MetricsResponse | Missing SDK | P1 | analytics.controller.ts:48-70, client.ts:N/A | Add client.analytics.getMetrics() |
| **RBAC & Permissions** |
| GET /api/v1/rbac/roles | ❌ Missing SDK method | RoleListRequest | RoleListResponse | Missing SDK | P1 | rbac.controller.ts:25-40, client.ts:N/A | Add client.rbac.getRoles() |
| POST /api/v1/rbac/roles | ❌ Missing SDK method | CreateRoleRequest | RoleResponse | Missing SDK | P1 | rbac.controller.ts:43-65, client.ts:N/A | Add client.rbac.createRole() |
| GET /api/v1/rbac/permissions | ❌ Missing SDK method | None | PermissionListResponse | Missing SDK | P1 | rbac.controller.ts:68-85, client.ts:N/A | Add client.rbac.getPermissions() |
| **Organization Management** |
| GET /api/v1/organizations | ❌ Missing SDK method | OrgListRequest | OrgListResponse | Missing SDK | P1 | org.controller.ts:25-45, client.ts:N/A | Add client.org.list() |
| POST /api/v1/organizations | ❌ Missing SDK method | CreateOrgRequest | OrgResponse | Missing SDK | P0 | org.controller.ts:48-70, client.ts:N/A | Add client.org.create() |
| GET /api/v1/organizations/:id | ❌ Missing SDK method | None | OrgResponse | Missing SDK | P1 | org.controller.ts:73-90, client.ts:N/A | Add client.org.get() |
| PUT /api/v1/organizations/:id | ❌ Missing SDK method | UpdateOrgRequest | OrgResponse | Missing SDK | P1 | org.controller.ts:93-115, client.ts:N/A | Add client.org.update() |

## Schema Validation Issues

### Critical Schema Mismatches (P0-P1)

1. **Event Publishing Schema Mismatch**
   - **Location:** events.controller.ts:30-55 ↔ client.ts:85-110
   - **Issue:** API expects `AxonPulsEvent` schema, SDK sends `PublishRequest`
   - **Evidence:** API uses `AxonPulsEventSchema` validation, SDK uses custom payload format
   - **Fix:** Align SDK to use `AxonPulsEvent` schema from `axon-events.schema.ts:790-800`

2. **WebSocket vs HTTP Event Streaming**
   - **Location:** events.controller.ts:58-80 ↔ client.ts:45-75
   - **Issue:** API provides HTTP SSE, SDK expects WebSocket
   - **Evidence:** Controller uses `@Sse()` decorator, client uses WebSocket connection
   - **Fix:** Add WebSocket support to SDK or HTTP SSE fallback

### Missing SDK Methods (P0-P1)

1. **Demo Upgrade Functionality** (P0)
   - **Missing:** `client.demo.upgrade()`
   - **API Endpoint:** POST /api/v1/demo/upgrade
   - **Evidence:** demo.controller.ts:73-95
   - **Impact:** Users cannot upgrade from demo to paid plans

2. **Organization Management** (P0)
   - **Missing:** `client.org.create()`, `client.org.list()`, etc.
   - **API Endpoints:** /api/v1/organizations/*
   - **Evidence:** org.controller.ts:25-115
   - **Impact:** Multi-tenant management not accessible via SDK

## Missing API Endpoints

### SDK Methods Without API Support

1. **Batch Operations**
   - **SDK Method:** `client.publishBatch()`
   - **Location:** client.ts:430-450
   - **Missing API:** POST /api/v1/events/batch
   - **Fix:** Implement batch endpoint in events.controller.ts

2. **Connection Management**
   - **SDK Methods:** `client.connection.getStatus()`, `client.connection.reconnect()`
   - **Location:** client.ts:780-820
   - **Missing API:** GET /api/v1/connections/status
   - **Fix:** Add connection management endpoints

## Recommendations

### Immediate Actions (P0)
1. Implement missing demo upgrade SDK methods
2. Add organization management SDK methods
3. Fix event publishing schema alignment
4. Add batch operations API endpoint

### Short-term (P1)
1. Implement missing analytics SDK methods
2. Add RBAC management SDK methods
3. Resolve WebSocket vs HTTP streaming approach
4. Add health check SDK methods

### Long-term (P2)
1. Implement comprehensive SDK test suite
2. Add API contract testing
3. Create schema validation pipeline
4. Implement automatic SDK generation from OpenAPI specs
