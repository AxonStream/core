/**
 * Framework Adapters - Auto-detect and lazy-load framework-specific bindings
 * 
 * Supports React, Vue, Angular with zero-config detection
 */

import type { AxonPulsClient } from '../core/client';
import { isReactEnvironment, isVueEnvironment, isAngularEnvironment } from '../utils/framework-detection';

export interface FrameworkAdapter {
    name: string;
    version: string;
    detectFramework(): boolean;
    createBinding(client: AxonPulsClient): any;
}

// Re-export consolidated framework detection utilities
export {
    detectReact as detectReactFramework,
    detectVue as detectVueFramework,
    detectAngular as detectAngularFramework,
    detectSvelte as detectSvelteFramework,
    detectAllFrameworks,
    isReactEnvironment,
    isVueEnvironment,
    isAngularEnvironment,
    isSvelteEnvironment,
    getPrimaryFramework,
    clearDetectionCache,
    getDetectionCacheStats
} from '../utils/framework-detection';

// Simplified framework detector using functional API
// Note: FrameworkDetector temporarily disabled due to missing universal-adapter
// export { FrameworkDetector } from '../framework/universal-adapter';

// Backward compatibility functions
export function detectReact(): boolean {
    return isReactEnvironment();
}

export function detectVue(): boolean {
    return isVueEnvironment();
}

export function detectAngular(): boolean {
    return isAngularEnvironment();
}

export function detectSvelte(): boolean {
    return isSvelteEnvironment();
}

// Fix for missing isSvelteEnvironment - add fallback
function isSvelteEnvironment(): boolean {
    if (typeof window !== 'undefined') {
        // Check for Svelte-specific globals
        return !!(window as any).__svelte ||
            !!(window as any).svelte ||
            document.querySelector('[data-svelte]') !== null;
    }
    return false;
}

export function detectFramework(): { framework: string; version?: string } | null {
    if (detectReact()) {
        return { framework: 'react', version: getReactVersion() };
    }
    if (detectVue()) {
        return { framework: 'vue', version: getVueVersion() };
    }
    if (detectAngular()) {
        return { framework: 'angular', version: getAngularVersion() };
    }
    return null;
}

function getReactVersion(): string {
    try {
        if (typeof window !== 'undefined' && (window as any).React) {
            return (window as any).React.version || 'unknown';
        }
        if (typeof require !== 'undefined') {
            return require('react').version || 'unknown';
        }
    } catch { }
    return 'unknown';
}

function getVueVersion(): string {
    try {
        if (typeof window !== 'undefined' && (window as any).Vue) {
            return (window as any).Vue.version || 'unknown';
        }
        if (typeof require !== 'undefined') {
            return require('vue').version || 'unknown';
        }
    } catch { }
    return 'unknown';
}

function getAngularVersion(): string {
    try {
        if (typeof require !== 'undefined') {
            return require('@angular/core').VERSION?.full || 'unknown';
        }
    } catch { }
    return 'unknown';
}

// Adapter registry
const adapters = new Map<string, FrameworkAdapter>();

export function registerAdapter(adapter: FrameworkAdapter) {
    adapters.set(adapter.name, adapter);
}

export function getAdapter(name: string): FrameworkAdapter | undefined {
    return adapters.get(name);
}

export function getAvailableAdapters(): string[] {
    return Array.from(adapters.keys());
}

// Auto-load and create bindings
export async function createFrameworkBinding(client: AxonPulsClient): Promise<any> {
    const detected = detectFramework();

    if (!detected) {
        return null; // No framework detected, return vanilla client
    }

    try {
        // Dynamically import the appropriate adapter
        switch (detected.framework) {
            case 'react':
                const reactAdapter = await import('./react.js');
                return reactAdapter.createReactBinding(client);

            case 'vue':
                const vueAdapter = await import('./vue.js');
                return vueAdapter.createVueBinding(client);

            case 'angular':
                const angularAdapter = await import('./angular.js');
                return angularAdapter.createAngularBinding(client);

            default:
                console.warn(`[AxonStream] Framework ${detected.framework} detected but no adapter available`);
                return null;
        }
    } catch (error) {
        console.warn(`[AxonStream] Failed to load ${detected.framework} adapter:`, error);
        return null;
    }
}

// Enhanced factory with auto-framework detection
export function createAxonStreamWithFramework(config: { org: string; token: string; debug?: boolean }) {
    const { createAxonStream } = require('../index');
    const axonstream = createAxonStream(config);

    // Auto-detect and enhance with framework bindings
    createFrameworkBinding(axonstream.client).then((binding) => {
        if (binding) {
            // Enhance the axonstream object with framework-specific methods
            Object.assign(axonstream, { framework: binding });
        }
    }).catch((error) => {
        if (config.debug) {
            console.warn('[AxonStream] Framework auto-detection failed:', error);
        }
    });

    return axonstream;
}
