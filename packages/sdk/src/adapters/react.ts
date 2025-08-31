/**
 * React Adapter - Integrates with @axonstream/react package
 * 
 * Auto-detects React and provides:
 * - Integration with production features
 * - Component wrappers for UI components
 * - Framework detection and binding
 * - Delegates hooks to @axonstream/react package (no duplication)
 */

import type { AxonPulsClient } from '../core/client';
import type { FrameworkAdapter } from './index';
import { isReactEnvironment } from '../utils/framework-detection';
import { globalPerformanceMonitor, globalErrorBoundary, globalCache } from '../utils/production-features';

// React binding interface - delegates to @axonstream/react package
export interface ReactBinding {
    // Hooks are provided by @axonstream/react package
    hooks: {
        useAxonpuls: any;
        useAxonpulsChannel: any;
        useAxonpulsPresence: any;
        useAxonpulsHITL: any;
    };
    // UI Components with production features integration
    components: {
        AxonChat: any;
        AxonPresence: any;
        AxonHITL: any;
        AxonEmbed: any;
        AxonDashboard: any;
    };
    // Production features
    productionFeatures: {
        errorBoundary: any;
        performanceMonitor: any;
        cache: any;
    };
}

// React binding implementation - integrates with @axonstream/react package
export function createReactBinding(client: AxonPulsClient): ReactBinding {
    // Import React hooks dynamically to avoid errors in non-React environments
    let React: any;
    let useState: any;
    let useEffect: any;
    let useRef: any;

    try {
        if (typeof window !== 'undefined' && (window as any).React) {
            React = (window as any).React;
        } else if (typeof require !== 'undefined') {
            React = require('react');
        } else {
            throw new Error('React not found');
        }

        ({ useState, useEffect, useRef } = React);
    } catch (error) {
        throw new Error('React adapter requires React to be available');
    }

    // Initialize production features for React environment
    globalPerformanceMonitor.startMonitoring();
    globalErrorBoundary.addRecoveryStrategy('ChunkLoadError', () => {
        window.location.reload();
    });

    // Delegate to @axonstream/react package for hooks
    let reactHooks: any = null;

    try {
        // Try to import react hooks package if available
        if (typeof require !== 'undefined') {
            reactHooks = require('@axonstream/react');
        }
    } catch (error) {
        console.warn('React hooks package not available. Install @axonstream/react for full functionality.');
    }

    // Create production-grade binding that integrates hooks with production features
    const binding = reactHooks ? reactHooks.createAxonpulsReactBinding(client) : null;

    // Create UI components with production features integration
    const components = {
        AxonDashboard: (props: any) => {
            const [DashboardComponent, setDashboardComponent] = useState(null);
            const dashboardRef = useRef(null);
            const containerRef = useRef(null);

            useEffect(() => {
                import('../ui/components/dashboard').then(module => {
                    setDashboardComponent(() => module.AxonDashboard);
                });
            }, []);

            useEffect(() => {
                if (containerRef.current && DashboardComponent && !dashboardRef.current) {
                    dashboardRef.current = new DashboardComponent({
                        client: props.client,
                        timeRange: props.timeRange || '24h',
                        refreshInterval: props.refreshInterval,
                        showAlerts: props.showAlerts !== false,
                        showPerformance: props.showPerformance !== false,
                        showUsage: props.showUsage !== false,
                        showSecurity: props.showSecurity !== false,
                        autoRefresh: props.autoRefresh !== false,
                        theme: props.theme || 'auto',
                        ...props
                    });
                    dashboardRef.current.mount(containerRef.current);
                }

                return () => {
                    if (dashboardRef.current) {
                        dashboardRef.current.unmount();
                        dashboardRef.current = null;
                    }
                };
            }, [DashboardComponent, props]);

            if (!DashboardComponent) {
                return React.createElement('div', {
                    style: { padding: '20px', textAlign: 'center', color: '#666' }
                }, 'Loading Dashboard Component...');
            }

            return React.createElement('div', { ref: containerRef });
        },

        // Placeholder components - to be implemented
        AxonChat: () => React.createElement('div', {}, 'AxonChat component - to be implemented'),
        AxonPresence: () => React.createElement('div', {}, 'AxonPresence component - to be implemented'),
        AxonHITL: () => React.createElement('div', {}, 'AxonHITL component - to be implemented'),
        AxonEmbed: () => React.createElement('div', {}, 'AxonEmbed component - to be implemented')
    };

    return {
        hooks: binding ? binding : {
            useAxonpuls: () => { throw new Error('Install @axonstream/react package for hooks'); },
            useAxonpulsChannel: () => { throw new Error('Install @axonstream/react package for hooks'); },
            useAxonpulsPresence: () => { throw new Error('Install @axonstream/react package for hooks'); },
            useAxonpulsHITL: () => { throw new Error('Install @axonstream/react package for hooks'); }
        },
        components,
        productionFeatures: {
            errorBoundary: globalErrorBoundary,
            performanceMonitor: globalPerformanceMonitor,
            cache: globalCache
        }
    };
}

// React Framework Adapter
export const reactAdapter: FrameworkAdapter = {
    name: 'react',
    version: '18.0.0',
    detectFramework: isReactEnvironment,
    createBinding: createReactBinding
};

// Export individual hooks for backward compatibility (delegates to @axonstream/react)
export function useAxonStream(client: AxonPulsClient, config?: { autoConnect?: boolean; debug?: boolean }) {
    const binding = createReactBinding(client);
    return binding.hooks.useAxonpuls(config);
}

export function useAxonChannel(channel: string, client: AxonPulsClient) {
    const binding = createReactBinding(client);
    return binding.hooks.useAxonpulsChannel(channel);
}

export function useAxonPresence(client: AxonPulsClient, options: { room: string; currentUser?: any }) {
    const binding = createReactBinding(client);
    return binding.hooks.useAxonpulsPresence(options);
}

export function useAxonHITL(client: AxonPulsClient, options: {
    department?: string;
    autoAcceptRoles?: string[];
    currentUser?: { id: string; name: string; role: string }
}) {
    const binding = createReactBinding(client);
    return binding.hooks.useAxonpulsHITL(options);
}
