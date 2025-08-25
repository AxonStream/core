/**
 * @axonstream/core - ONE PACKAGE FOR EVERYTHING
 * 
 * Install once, everything works:
 * - Core SDK (connect, subscribe, publish, replay)
 * - React/Vue/Angular adapters (auto-detect & lazy load)  
 * - UI Components (headless + themed)
 * - Embed helper (AXONUI.mount)
 * - CDN build (global window access)
 * - Self-healing, multi-tenant, HITL
 * 
 * @example
 * ```typescript
 * import { createAxonStream } from '@axonstream/core';
 * 
 * // ONE COMMAND - ALL DONE
 * const axon = await createAxonStream({ org: 'my-org', token: 'jwt-token' });
 * await axon.connect();
 * ```
 */

// Import types and classes
import { AxonPulsClient, createAxonPulsClient, type AxonPulsClientConfig } from './core/client';

// Core SDK exports - Always available
export { AxonPulsClient } from './core/client';
export type {
  AxonPulsClientConfig,
  AxonPulsEvent,
  SubscribeOptions,
  PublishOptions,
  JwtPayload
} from './core/client';

// Embed functionality - Temporarily disabled due to UI component dependency
// TODO: Re-enable after fixing UI component class inheritance issue
// export { AxonEmbed, mount as mountAxonUI } from './embed';
// export type { EmbedConfig } from './embed';

// Framework Adapters - Auto-detect and lazy-load
export {
  detectFramework,
  createFrameworkBinding,
  createAxonStreamWithFramework
} from './adapters/index';
export type { FrameworkAdapter } from './adapters/index';

// UI Components - Temporarily disabled to fix class inheritance issue
// TODO: Fix AxonUIComponent bundling issue where class extends value undefined
// export {
//   AxonChat,
//   AxonPresence,
//   AxonHITL,
//   AxonEmbed as AxonEmbedComponent,
//   AxonNotifications,
//   createChat,
//   createPresence,
//   createHITL,
//   createEmbed,
//   createNotifications,
//   createUI,
//   AxonUIBuilder,
//   themes,
//   getTheme
// } from './ui/index';
// export type {
//   ComponentConfig,
//   ChatConfig,
//   PresenceConfig,
//   HITLConfig,
//   EmbedConfig as UIEmbedConfig
// } from './ui/index';

// Enhanced factory function that matches REAL_PROJECT_PLAN.md  
export function createAxonStream(config: { org: string; token: string; debug?: boolean }) {
  const client = new AxonPulsClient({
    url: `wss://${config.org}.axonstream.ai`,
    token: config.token,
    autoReconnect: true,
    debug: config.debug || false
  });

  return {
    client,
    connect: () => client.connect(),
    disconnect: () => client.disconnect(),
    publish: (channel: string, data: any) => client.publish(channel, { type: 'event', payload: data }),
    subscribe: (channels: string[]) => client.subscribe(channels),
    on: (event: string, handler: (data: any) => void) => client.on(event, handler),
    isConnected: () => client.isConnected(),
    // Enhanced UI system with auto-framework detection
    ui: {
      render: (selector: string, type = 'chat', config = {}) => {
        try {
          const { createUI } = require('./ui');
          const component = createUI(client, type, { channel: 'default', ...config });
          component.mount(selector);
          return component;
        } catch (error) {
          console.error('Failed to render UI component:', error);
          throw error;
        }
      },
      builder: () => {
        const { AxonUIBuilder } = require('./ui');
        return new AxonUIBuilder(client);
      },
      chat: (config: any) => {
        const { createChat } = require('./ui');
        return createChat({ client, ...config });
      },
      presence: (config: any) => {
        const { createPresence } = require('./ui');
        return createPresence({ client, ...config });
      },
      hitl: (config: any) => {
        const { createHITL } = require('./ui');
        return createHITL({ client, ...config });
      },
      embed: (config: any) => {
        const { createEmbed } = require('./ui');
        return createEmbed({ client, ...config });
      }
    },
    // Framework adapter integration
    framework: null // Will be populated by createFrameworkBinding
  };
}

export { createAxonPulsClient };
export const version = '1.0.0';
export * from './core/client';
export * from './core/contracts';
export * from './errors/index';
