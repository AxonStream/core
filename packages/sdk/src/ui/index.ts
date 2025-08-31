/**
 * AXONUI - Complete UI Component System
 *
 * Provides headless and themed components for real-time features:
 * - Chat interfaces
 * - Presence indicators
 * - HITL approval flows
 * - Event monitoring
 * - Embeddable widgets
 */

// Re-export base components and utilities
export * from './base';

// Re-export component-specific config interfaces
export type { ChatConfig } from './components/chat';
export type { PresenceConfig } from './components/presence';
export type { HITLConfig } from './components/hitl';
export type { EmbedConfig } from './components/embed';



// Export component classes
export { AxonChat } from './components/chat';
export { AxonPresence } from './components/presence';
export { AxonHITL } from './components/hitl';
export { AxonEmbed } from './components/embed';
export { AxonNotifications } from './components/notifications';

// Export factory functions
export * from './factory';
