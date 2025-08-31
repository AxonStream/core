/**
 * 🎯 MAGIC FACTORY FUNCTIONS
 * Zero-friction onboarding for AxonPuls platform
 * Users can start using the platform immediately without JWT tokens
 */

import { AxonPulsClient, type AxonPulsClientConfig } from './core/client';

/**
 * 🚀 MAGIC AUTO-TRIAL CLIENT
 * Just provide email - everything else is automatic!
 * Perfect for demos, trials, and getting started
 */
export async function createTrialClient(options: {
    email: string;
    url?: string;
    debug?: boolean;
}): Promise<AxonPulsClient> {
    const config: AxonPulsClientConfig = {
        url: options.url || 'ws://localhost:3001',
        mode: 'auto-trial',
        email: options.email,
        debug: options.debug || false,
        autoReconnect: true,
        trialMode: true
    };

    const client = new AxonPulsClient(config);
    
    // Auto-connect for seamless experience
    await client.connect();
    
    return client;
}

/**
 * 🎭 DEMO CLIENT
 * No authentication required - perfect for demos and testing
 */
export function createDemoClient(options: {
    url?: string;
    debug?: boolean;
} = {}): AxonPulsClient {
    const config: AxonPulsClientConfig = {
        url: options.url || 'ws://localhost:3001',
        mode: 'demo',
        skipAuth: true,
        debug: options.debug || false,
        autoReconnect: true
    };

    return new AxonPulsClient(config);
}

/**
 * 🔧 ADVANCED CLIENT FACTORY
 * For users who want more control
 */
export function createAxonPulsClient(config: AxonPulsClientConfig): AxonPulsClient {
    return new AxonPulsClient(config);
}

/**
 * 🎯 MAGIC ONE-LINER
 * The simplest possible way to get started
 * 
 * @example
 * ```typescript
 * // Just this one line!
 * const axon = await createMagicClient('your-email@example.com');
 * 
 * // Start using immediately
 * await axon.subscribe(['my-channel']);
 * await axon.publish('my-channel', { message: 'Hello World!' });
 * ```
 */
export async function createMagicClient(
    email: string, 
    options: { url?: string; debug?: boolean } = {}
): Promise<AxonPulsClient> {
    return createTrialClient({
        email,
        url: options.url,
        debug: options.debug
    });
}

/**
 * 🌟 ZERO-CONFIG CLIENT
 * For when you just want to try things out
 * No email, no tokens, no configuration - just works!
 */
export function createZeroConfigClient(): AxonPulsClient {
    return createDemoClient({
        debug: true
    });
}

// 🎯 USAGE EXAMPLES FOR DOCUMENTATION:

/*
// 🚀 TRIAL MODE (Recommended for new users)
const client = await createTrialClient({
    email: 'user@example.com',
    url: 'wss://your-org.axonstream.ai'
});

// 🎭 DEMO MODE (No signup required)
const demo = createDemoClient({
    url: 'ws://localhost:3001'
});
await demo.connect();

// 🎯 ONE-LINER MAGIC
const magic = await createMagicClient('user@example.com');

// 🌟 ZERO CONFIG
const zero = createZeroConfigClient();
await zero.connect();

// 🔧 ADVANCED (Full control)
const advanced = createAxonPulsClient({
    url: 'wss://api.axonstream.ai',
    token: 'your-jwt-token',
    mode: 'jwt',
    autoReconnect: true,
    debug: false
});
*/
