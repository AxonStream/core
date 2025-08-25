// Main AXONPULS React Hooks Library
export { useAxonpuls } from './hooks/useAxonpuls';
export { useAxonpulsChannel } from './hooks/useAxonpulsChannel';
export { useAxonpulsHITL } from './hooks/useAxonpulsHITL';
export { useAxonpulsPresence } from './hooks/useAxonpulsPresence';

// Re-export types
export type { 
    AxonpulsConfig,
    AxonpulsConnection,
} from './hooks/useAxonpuls';

export type {
    ChannelMessage,
    ChannelState,
} from './hooks/useAxonpulsChannel';

export type {
    HITLRequest,
    HITLResponse,
    HITLState,
} from './hooks/useAxonpulsHITL';

export type {
    PresenceUser,
    PresenceState,
} from './hooks/useAxonpulsPresence';

// Integration with core SDK adapters  
// Enhanced factory function that integrates with core SDK
export function createAxonpulsReactBinding(client: any) {
  // This will be implemented when the core SDK is built
  console.log('React binding integration with core SDK');
  return null;
}