/**
 * 🚀 AXONPULS SDK - Enterprise Real-Time Platform
 * 
 * The world's most advanced real-time collaboration platform
 * Built for enterprise scale with Magic collaboration features
 * 
 * @version 2.0.0
 * @author AxonStreamAI
 * @license MIT
 */

// Core Client
export { AxonPulsClient } from './core/client';
export type { AxonPulsClientConfig, AxonPulsEvent, SubscribeOptions, PublishOptions } from './core/client';

// SDK Modules
export { OrganizationClient } from './core/organization';
export { HealthClient } from './core/health';
export { AuthClient } from './core/auth';
export { DemoClient } from './core/demo';
export { AnalyticsClient } from './core/analytics';
export { RBACClient } from './core/rbac';
export { ErrorFactory, ErrorHandler } from './core/errors';
export type {
  Organization,
  OrganizationSettings,
  OrganizationLimits,
  OrganizationMember,
  CreateOrganizationRequest,
  UpdateOrganizationRequest,
  InviteMemberRequest,
  OrganizationUsage
} from './core/organization';
export type {
  HealthResponse,
  HealthCheck,
  ServiceHealth,
  PerformanceMetrics,
  WebSocketHealthResponse,
  ReadinessResponse,
  LivenessResponse,
  SystemMetrics
} from './core/health';

// 🎯 MAGIC FACTORY FUNCTIONS - Zero-friction onboarding
export { createAxonPulsClient, createTrialClient, createDemoClient, createMagicClient, createZeroConfigClient } from './factory';

// 🎯 LEGACY COMPATIBILITY
export { createAxonPulsClient as createAxonStream } from './factory';

// Event Emitter (Fixed duplication)
export { EventEmitter } from './core/event-emitter';
export type { EventMap, DefaultEvents, EventListener } from './core/event-emitter';

// Contracts & Schemas (Hardened UUID)
export { generateUUID } from './core/contracts';

// Magic Collaboration (Game-Changing Feature)
export { MagicCollaboration } from './magic/magic-collaboration';
export { MagicTimeTravel } from './magic/magic-time-travel';
export { MagicPresence } from './magic/magic-presence';
export type {
  MagicOperation,
  MagicState,
  MagicRoom,
  MagicSnapshot,
  MagicBranch,
  ConflictResolutionStrategy
} from './magic/types';

// Framework Detection & Adapters
// Note: Universal adapter temporarily disabled due to complex type conflicts
// export { createUniversalAdapter } from './framework/universal-adapter';

// Utilities & Helpers
export {
  resolveApiUrl,
  resolveAuthToken,
  resolveApiKey,
  resolveOrganization,
  detectEnvironment
} from './utils/helpers';

// Error Handling
export { AxonPulsError, AxonPulsErrorCode } from './errors';

// Configuration
export { createMagicConfig, MagicConfigs } from './config/default-config';
export { DEFAULT_UI_CONFIG, UIConfigManager } from './config/ui-config';

// Production Features
export { ProductionErrorBoundary } from './utils/production-features';

// Framework Adapters
export { reactAdapter } from './adapters/react';
export { VueAdapter } from './adapters/vue';
export { AngularAdapter } from './adapters/angular';
export type { ReactBinding } from './adapters/react';
export type { VueBinding } from './adapters/vue';
export type { AngularBinding } from './adapters/angular';

// Framework Detection Utilities
export {
  detectAllFrameworks,
  detectReact,
  detectVue,
  detectAngular,
  detectSvelte,
  isReactEnvironment,
  isVueEnvironment,
  isAngularEnvironment,
  isSvelteEnvironment
} from './utils/framework-detection';

// CDN Build - Temporarily disabled due to missing factory functions
// export { AxonSDK, createAxonStream } from './cdn';

// Embed Components
export { AxonEmbed, mount as createEmbedComponent } from './embed';
export type { EmbedConfig } from './embed';
