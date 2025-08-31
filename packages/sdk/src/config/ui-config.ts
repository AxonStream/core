/**
 * UI Configuration System
 * 
 * Centralizes all UI defaults and makes them configurable
 * Replaces hardcoded values throughout the UI components
 */

export interface UIConfig {
  chat: {
    placeholder: string;
    maxMessages: number;
    showTimestamps: boolean;
    showTypes: boolean;
    enableInput: boolean;
    enableEmoji: boolean;
    enableFileUpload: boolean;
    autoScroll: boolean;
    messageLimit: number;
    retryAttempts: number;
    retryDelay: number;
  };
  presence: {
    updateInterval: number;
    maxUsers: number;
    showAvatars: boolean;
    showStatus: boolean;
    heartbeatInterval: number;
    timeoutMs: number;
  };
  hitl: {
    autoAcceptRoles: string[];
    showPriority: boolean;
    maxRequests: number;
    requestTimeout: number;
    escalationTimeout: number;
    refreshInterval: number;
  };
  embed: {
    defaultWidth: string;
    defaultHeight: string;
    defaultFeatures: Array<'chat' | 'presence' | 'hitl' | 'notifications'>;
    maxFeatures: number;
    loadTimeout: number;
  };
  theme: {
    default: 'light' | 'dark' | 'auto';
    transitionDuration: string;
    borderRadius: string;
    spacing: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
    };
  };
  performance: {
    debounceMs: number;
    throttleMs: number;
    virtualScrollThreshold: number;
    lazyLoadOffset: number;
  };
  accessibility: {
    enableKeyboardNavigation: boolean;
    enableScreenReader: boolean;
    highContrastMode: boolean;
    reducedMotion: boolean;
  };
  dashboard: {
    refreshInterval: number;
    autoRefresh: boolean;
    showAlerts: boolean;
    showPerformance: boolean;
    showUsage: boolean;
    showSecurity: boolean;
    maxAlerts: number;
    chartUpdateInterval: number;
  };
}

// Production-grade default configuration
export const DEFAULT_UI_CONFIG: UIConfig = {
  chat: {
    placeholder: process.env.AXON_CHAT_PLACEHOLDER || 'Type a message...',
    maxMessages: parseInt(process.env.AXON_CHAT_MAX_MESSAGES || '100'),
    showTimestamps: process.env.AXON_CHAT_SHOW_TIMESTAMPS !== 'false',
    showTypes: process.env.AXON_CHAT_SHOW_TYPES === 'true',
    enableInput: process.env.AXON_CHAT_ENABLE_INPUT !== 'false',
    enableEmoji: process.env.AXON_CHAT_ENABLE_EMOJI !== 'false',
    enableFileUpload: process.env.AXON_CHAT_ENABLE_FILE_UPLOAD !== 'false',
    autoScroll: process.env.AXON_CHAT_AUTO_SCROLL !== 'false',
    messageLimit: parseInt(process.env.AXON_CHAT_MESSAGE_LIMIT || '1000'),
    retryAttempts: parseInt(process.env.AXON_CHAT_RETRY_ATTEMPTS || '3'),
    retryDelay: parseInt(process.env.AXON_CHAT_RETRY_DELAY || '1000'),
  },
  presence: {
    updateInterval: parseInt(process.env.AXON_PRESENCE_UPDATE_INTERVAL || '30000'),
    maxUsers: parseInt(process.env.AXON_PRESENCE_MAX_USERS || '100'),
    showAvatars: process.env.AXON_PRESENCE_SHOW_AVATARS !== 'false',
    showStatus: process.env.AXON_PRESENCE_SHOW_STATUS !== 'false',
    heartbeatInterval: parseInt(process.env.AXON_PRESENCE_HEARTBEAT_INTERVAL || '30000'),
    timeoutMs: parseInt(process.env.AXON_PRESENCE_TIMEOUT_MS || '300000'),
  },
  hitl: {
    autoAcceptRoles: (process.env.AXON_HITL_AUTO_ACCEPT_ROLES || 'admin,supervisor').split(','),
    showPriority: process.env.AXON_HITL_SHOW_PRIORITY !== 'false',
    maxRequests: parseInt(process.env.AXON_HITL_MAX_REQUESTS || '50'),
    requestTimeout: parseInt(process.env.AXON_HITL_REQUEST_TIMEOUT || '300000'),
    escalationTimeout: parseInt(process.env.AXON_HITL_ESCALATION_TIMEOUT || '600000'),
    refreshInterval: parseInt(process.env.AXON_HITL_REFRESH_INTERVAL || '5000'),
  },
  embed: {
    defaultWidth: process.env.AXON_EMBED_DEFAULT_WIDTH || '400px',
    defaultHeight: process.env.AXON_EMBED_DEFAULT_HEIGHT || '500px',
    defaultFeatures: (process.env.AXON_EMBED_DEFAULT_FEATURES || 'chat,presence').split(',') as Array<'chat' | 'presence' | 'hitl' | 'notifications'>,
    maxFeatures: parseInt(process.env.AXON_EMBED_MAX_FEATURES || '5'),
    loadTimeout: parseInt(process.env.AXON_EMBED_LOAD_TIMEOUT || '10000'),
  },
  theme: {
    default: (process.env.AXON_THEME_DEFAULT as 'light' | 'dark' | 'auto') || 'auto',
    transitionDuration: process.env.AXON_THEME_TRANSITION_DURATION || '200ms',
    borderRadius: process.env.AXON_THEME_BORDER_RADIUS || '8px',
    spacing: {
      xs: process.env.AXON_THEME_SPACING_XS || '4px',
      sm: process.env.AXON_THEME_SPACING_SM || '8px',
      md: process.env.AXON_THEME_SPACING_MD || '16px',
      lg: process.env.AXON_THEME_SPACING_LG || '24px',
      xl: process.env.AXON_THEME_SPACING_XL || '32px',
    },
  },
  performance: {
    debounceMs: parseInt(process.env.AXON_PERFORMANCE_DEBOUNCE_MS || '300'),
    throttleMs: parseInt(process.env.AXON_PERFORMANCE_THROTTLE_MS || '100'),
    virtualScrollThreshold: parseInt(process.env.AXON_PERFORMANCE_VIRTUAL_SCROLL_THRESHOLD || '100'),
    lazyLoadOffset: parseInt(process.env.AXON_PERFORMANCE_LAZY_LOAD_OFFSET || '200'),
  },
  accessibility: {
    enableKeyboardNavigation: process.env.AXON_A11Y_KEYBOARD_NAVIGATION !== 'false',
    enableScreenReader: process.env.AXON_A11Y_SCREEN_READER !== 'false',
    highContrastMode: process.env.AXON_A11Y_HIGH_CONTRAST === 'true',
    reducedMotion: process.env.AXON_A11Y_REDUCED_MOTION === 'true',
  },
  dashboard: {
    refreshInterval: parseInt(process.env.AXON_DASHBOARD_REFRESH_INTERVAL || '30000'),
    autoRefresh: process.env.AXON_DASHBOARD_AUTO_REFRESH !== 'false',
    showAlerts: process.env.AXON_DASHBOARD_SHOW_ALERTS !== 'false',
    showPerformance: process.env.AXON_DASHBOARD_SHOW_PERFORMANCE !== 'false',
    showUsage: process.env.AXON_DASHBOARD_SHOW_USAGE !== 'false',
    showSecurity: process.env.AXON_DASHBOARD_SHOW_SECURITY !== 'false',
    maxAlerts: parseInt(process.env.AXON_DASHBOARD_MAX_ALERTS || '50'),
    chartUpdateInterval: parseInt(process.env.AXON_DASHBOARD_CHART_UPDATE_INTERVAL || '5000'),
  },
};

// Configuration manager with validation and hot-reload support
export class UIConfigManager {
  private config: UIConfig;
  private listeners: Array<(config: UIConfig) => void> = [];

  constructor(initialConfig?: Partial<UIConfig>) {
    this.config = this.mergeConfig(DEFAULT_UI_CONFIG, initialConfig || {});
    this.validateConfig();
  }

  public getConfig(): UIConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<UIConfig>): void {
    const newConfig = this.mergeConfig(this.config, updates);
    this.validateConfig(newConfig);
    this.config = newConfig;
    this.notifyListeners();
  }

  public subscribe(listener: (config: UIConfig) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private mergeConfig(base: UIConfig, updates: Partial<UIConfig>): UIConfig {
    return {
      chat: { ...base.chat, ...updates.chat },
      presence: { ...base.presence, ...updates.presence },
      hitl: { ...base.hitl, ...updates.hitl },
      embed: { ...base.embed, ...updates.embed },
      theme: {
        ...base.theme,
        ...updates.theme,
        spacing: { ...base.theme.spacing, ...updates.theme?.spacing }
      },
      performance: { ...base.performance, ...updates.performance },
      accessibility: { ...base.accessibility, ...updates.accessibility },
      dashboard: { ...base.dashboard, ...updates.dashboard },
    };
  }

  private validateConfig(config: UIConfig = this.config): void {
    // Validate numeric ranges
    if (config.chat.maxMessages < 1 || config.chat.maxMessages > 10000) {
      throw new Error('Chat maxMessages must be between 1 and 10000');
    }

    if (config.presence.updateInterval < 1000 || config.presence.updateInterval > 300000) {
      throw new Error('Presence updateInterval must be between 1000ms and 300000ms');
    }

    if (config.hitl.maxRequests < 1 || config.hitl.maxRequests > 1000) {
      throw new Error('HITL maxRequests must be between 1 and 1000');
    }

    // Validate theme values
    if (!['light', 'dark', 'auto'].includes(config.theme.default)) {
      throw new Error('Theme default must be light, dark, or auto');
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.getConfig());
      } catch (error) {
        console.error('Error in UI config listener:', error);
      }
    });
  }
}

// Global configuration instance
export const uiConfig = new UIConfigManager();

// Utility functions for components
export function getChatConfig(): UIConfig['chat'] {
  return uiConfig.getConfig().chat;
}

export function getPresenceConfig(): UIConfig['presence'] {
  return uiConfig.getConfig().presence;
}

export function getHITLConfig(): UIConfig['hitl'] {
  return uiConfig.getConfig().hitl;
}

export function getEmbedConfig(): UIConfig['embed'] {
  return uiConfig.getConfig().embed;
}

export function getThemeConfig(): UIConfig['theme'] {
  return uiConfig.getConfig().theme;
}

export function getDashboardConfig(): UIConfig['dashboard'] {
  return uiConfig.getConfig().dashboard;
}

// Environment variable documentation for .env files
export const UI_ENV_VARS_DOCUMENTATION = `
# AxonStream UI Configuration
# All values are optional and have sensible defaults

# Chat Component
AXON_CHAT_PLACEHOLDER="Type a message..."
AXON_CHAT_MAX_MESSAGES=100
AXON_CHAT_SHOW_TIMESTAMPS=true
AXON_CHAT_SHOW_TYPES=false
AXON_CHAT_ENABLE_INPUT=true
AXON_CHAT_ENABLE_EMOJI=true
AXON_CHAT_ENABLE_FILE_UPLOAD=true
AXON_CHAT_AUTO_SCROLL=true
AXON_CHAT_MESSAGE_LIMIT=1000
AXON_CHAT_RETRY_ATTEMPTS=3
AXON_CHAT_RETRY_DELAY=1000

# Presence Component
AXON_PRESENCE_UPDATE_INTERVAL=30000
AXON_PRESENCE_MAX_USERS=100
AXON_PRESENCE_SHOW_AVATARS=true
AXON_PRESENCE_SHOW_STATUS=true
AXON_PRESENCE_HEARTBEAT_INTERVAL=30000
AXON_PRESENCE_TIMEOUT_MS=300000

# HITL Component
AXON_HITL_AUTO_ACCEPT_ROLES="admin,supervisor"
AXON_HITL_SHOW_PRIORITY=true
AXON_HITL_MAX_REQUESTS=50
AXON_HITL_REQUEST_TIMEOUT=300000
AXON_HITL_ESCALATION_TIMEOUT=600000
AXON_HITL_REFRESH_INTERVAL=5000

# Embed Component
AXON_EMBED_DEFAULT_WIDTH="400px"
AXON_EMBED_DEFAULT_HEIGHT="500px"
AXON_EMBED_DEFAULT_FEATURES="chat,presence"
AXON_EMBED_MAX_FEATURES=5
AXON_EMBED_LOAD_TIMEOUT=10000

# Theme Configuration
AXON_THEME_DEFAULT="auto"
AXON_THEME_TRANSITION_DURATION="200ms"
AXON_THEME_BORDER_RADIUS="8px"
AXON_THEME_SPACING_XS="4px"
AXON_THEME_SPACING_SM="8px"
AXON_THEME_SPACING_MD="16px"
AXON_THEME_SPACING_LG="24px"
AXON_THEME_SPACING_XL="32px"

# Performance Configuration
AXON_PERFORMANCE_DEBOUNCE_MS=300
AXON_PERFORMANCE_THROTTLE_MS=100
AXON_PERFORMANCE_VIRTUAL_SCROLL_THRESHOLD=100
AXON_PERFORMANCE_LAZY_LOAD_OFFSET=200

# Accessibility Configuration
AXON_A11Y_KEYBOARD_NAVIGATION=true
AXON_A11Y_SCREEN_READER=true
AXON_A11Y_HIGH_CONTRAST=false
AXON_A11Y_REDUCED_MOTION=false

# Dashboard Configuration
AXON_DASHBOARD_REFRESH_INTERVAL=30000
AXON_DASHBOARD_AUTO_REFRESH=true
AXON_DASHBOARD_SHOW_ALERTS=true
AXON_DASHBOARD_SHOW_PERFORMANCE=true
AXON_DASHBOARD_SHOW_USAGE=true
AXON_DASHBOARD_SHOW_SECURITY=true
AXON_DASHBOARD_MAX_ALERTS=50
AXON_DASHBOARD_CHART_UPDATE_INTERVAL=5000
`;
