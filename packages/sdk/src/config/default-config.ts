/**
 * ⚙️ DEFAULT CONFIGURATION
 * 
 * Sensible defaults for all SDK features
 * Can be overridden by users for custom behavior
 */

export interface SDKConfig {
  // Core settings
  core: {
    autoReconnect: boolean;
    reconnectAttempts: number;
    reconnectDelay: number;
    heartbeatInterval: number;
    connectionTimeout: number;
    maxPayloadSize: number;
  };

  // Magic collaboration
  magic: {
    enabled: boolean;
    defaultConflictResolution: string;
    autoSnapshot: boolean;
    snapshotInterval: number;
    maxSnapshots: number;
    presenceEnabled: boolean;
    timeTravelEnabled: boolean;
  };

  // Framework detection
  framework: {
    autoDetect: boolean;
    preferredFramework?: string;
    fallbackToVanilla: boolean;
    enableLazyLoading: boolean;
  };

  // Performance & monitoring
  performance: {
    enableLatencyTracking: boolean;
    enableMetrics: boolean;
    enableHealthMonitoring: boolean;
    metricsInterval: number;
    maxMetricsHistory: number;
  };

  // Security
  security: {
    enableTokenRefresh: boolean;
    tokenRefreshThreshold: number;
    enableRequestSigning: boolean;
    maxRetryAttempts: number;
  };

  // Webhooks & integrations
  webhooks: {
    enabled: boolean;
    maxRetries: number;
    retryDelay: number;
    timeout: number;
    enableTemplates: boolean;
  };

  // Debug & logging
  debug: {
    enabled: boolean;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
    enablePerformanceLogging: boolean;
    enableNetworkLogging: boolean;
  };
}

export const defaultConfig: SDKConfig = {
  core: {
    autoReconnect: true,
    reconnectAttempts: 5,
    reconnectDelay: 1000,
    heartbeatInterval: 30000,
    connectionTimeout: 10000,
    maxPayloadSize: 1024 * 1024, // 1MB
  },

  magic: {
    enabled: true,
    defaultConflictResolution: 'operational_transform',
    autoSnapshot: true,
    snapshotInterval: 5 * 60 * 1000, // 5 minutes
    maxSnapshots: 100,
    presenceEnabled: true,
    timeTravelEnabled: true,
  },

  framework: {
    autoDetect: true,
    fallbackToVanilla: true,
    enableLazyLoading: true,
  },

  performance: {
    enableLatencyTracking: true,
    enableMetrics: true,
    enableHealthMonitoring: true,
    metricsInterval: 60000, // 1 minute
    maxMetricsHistory: 1000,
  },

  security: {
    enableTokenRefresh: true,
    tokenRefreshThreshold: 5 * 60 * 1000, // 5 minutes
    enableRequestSigning: false,
    maxRetryAttempts: 3,
  },

  webhooks: {
    enabled: true,
    maxRetries: 3,
    retryDelay: 1000,
    timeout: 10000,
    enableTemplates: true,
  },

  debug: {
    enabled: false,
    logLevel: 'warn',
    enablePerformanceLogging: false,
    enableNetworkLogging: false,
  },
};

/**
 * Merge user config with defaults
 */
export function mergeConfig(userConfig: Partial<SDKConfig>): SDKConfig {
  const merged = JSON.parse(JSON.stringify(defaultConfig));

  function deepMerge(target: any, source: any): void {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }

  deepMerge(merged, userConfig);
  return merged;
}

/**
 * Validate configuration
 */
export function validateConfig(config: SDKConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Core validation
  if (config.core.reconnectAttempts < 0) {
    errors.push('reconnectAttempts must be >= 0');
  }

  if (config.core.reconnectDelay < 100) {
    errors.push('reconnectDelay must be >= 100ms');
  }

  if (config.core.heartbeatInterval < 1000) {
    errors.push('heartbeatInterval must be >= 1000ms');
  }

  // Magic validation
  if (config.magic.snapshotInterval < 1000) {
    errors.push('snapshotInterval must be >= 1000ms');
  }

  if (config.magic.maxSnapshots < 1) {
    errors.push('maxSnapshots must be >= 1');
  }

  // Performance validation
  if (config.performance.metricsInterval < 1000) {
    errors.push('metricsInterval must be >= 1000ms');
  }

  if (config.performance.maxMetricsHistory < 10) {
    errors.push('maxMetricsHistory must be >= 10');
  }

  // Security validation
  if (config.security.tokenRefreshThreshold < 1000) {
    errors.push('tokenRefreshThreshold must be >= 1000ms');
  }

  if (config.security.maxRetryAttempts < 0) {
    errors.push('maxRetryAttempts must be >= 0');
  }

  // Webhooks validation
  if (config.webhooks.maxRetries < 0) {
    errors.push('maxRetries must be >= 0');
  }

  if (config.webhooks.retryDelay < 100) {
    errors.push('retryDelay must be >= 100ms');
  }

  if (config.webhooks.timeout < 1000) {
    errors.push('timeout must be >= 1000ms');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get environment-specific configuration
 */
export function getEnvironmentConfig(environment: 'development' | 'staging' | 'production'): Partial<SDKConfig> {
  switch (environment) {
    case 'development':
      return {
        debug: {
          enabled: true,
          logLevel: 'debug',
          enablePerformanceLogging: true,
          enableNetworkLogging: true,
        },
        performance: {
          enableLatencyTracking: true,
          enableMetrics: true,
          enableHealthMonitoring: true,
          metricsInterval: 30000, // 30 seconds for dev
          maxMetricsHistory: 1000
        }
      };

    case 'staging':
      return {
        debug: {
          enabled: true,
          logLevel: 'info',
          enablePerformanceLogging: true,
          enableNetworkLogging: false,
        },
        performance: {
          enableLatencyTracking: true,
          enableMetrics: true,
          enableHealthMonitoring: true,
          metricsInterval: 60000, // 1 minute for staging
          maxMetricsHistory: 500
        }
      };

    case 'production':
      return {
        debug: {
          enabled: false,
          logLevel: 'error',
          enablePerformanceLogging: false,
          enableNetworkLogging: false,
        },
        performance: {
          enableLatencyTracking: true,
          enableMetrics: true,
          enableHealthMonitoring: true,
          metricsInterval: 300000, // 5 minutes for production
          maxMetricsHistory: 100
        },
        security: {
          enableTokenRefresh: true,
          tokenRefreshThreshold: 300, // 5 minutes before expiry
          enableRequestSigning: true,
          maxRetryAttempts: 2, // Fewer retries in production
        }
      };

    default:
      return {};
  }
}

/**
 * Create production-ready configuration
 */
export function createProductionConfig(): SDKConfig {
  const envConfig = getEnvironmentConfig('production');
  return mergeConfig(envConfig);
}

/**
 * 🎭 MAGIC CONFIGURATION FUNCTIONS
 * Auto-detect and create optimal configurations
 */

export interface MagicConfigOptions {
  url?: string;
  token?: string;
  apiKey?: string;
  org?: string;
  autoDetect?: boolean;
  environment?: 'development' | 'staging' | 'production' | 'auto';
  debug?: boolean;
  enableMagic?: boolean;
  gracefulDegradation?: boolean;
}

/**
 * 🎯 MAGIC CONFIG RESOLVER - Auto-detect everything
 */
export function createMagicConfig(options: MagicConfigOptions = {}): SDKConfig {
  const environment = options.environment === 'auto' || !options.environment
    ? detectEnvironment()
    : options.environment;

  const baseConfig = environment === 'development'
    ? createDevelopmentConfig()
    : createProductionConfig();

  // Magic overrides
  const magicOverrides: Partial<SDKConfig> = {
    debug: {
      ...baseConfig.debug,
      enabled: options.debug !== undefined ? options.debug : environment === 'development',
    },
    magic: {
      ...baseConfig.magic,
      enabled: options.enableMagic !== false,
    },
    core: {
      ...baseConfig.core,
      autoReconnect: true, // Always enable for magic approach
    }
  };

  // Merge magic overrides into base config
  const mergedConfig = { ...baseConfig };
  Object.assign(mergedConfig, magicOverrides);
  return mergeConfig(mergedConfig);
}

/**
 * 🚀 QUICK START CONFIGS
 */
export const MagicConfigs = {
  demo: (): MagicConfigOptions => ({
    org: 'demo',
    environment: 'development',
    debug: true,
    enableMagic: true,
    gracefulDegradation: true,
  }),

  development: (org = 'demo'): MagicConfigOptions => ({
    org,
    environment: 'development',
    debug: true,
    enableMagic: true,
    gracefulDegradation: true,
  }),

  production: (org: string, token: string): MagicConfigOptions => ({
    org,
    token,
    environment: 'production',
    debug: false,
    enableMagic: true,
    gracefulDegradation: true,
  }),
};

/**
 * 🌍 ENVIRONMENT DETECTION
 */
function detectEnvironment(): 'development' | 'staging' | 'production' {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV) {
    if (process.env.NODE_ENV === 'development') return 'development';
    if (process.env.NODE_ENV === 'production') return 'production';
  }

  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
      return 'development';
    }
    if (hostname.includes('staging')) {
      return 'staging';
    }
  }

  return 'production';
}

/**
 * Create development configuration
 */
export function createDevelopmentConfig(): SDKConfig {
  const envConfig = getEnvironmentConfig('development');
  return mergeConfig(envConfig);
}
