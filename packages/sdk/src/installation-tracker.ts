/**
 * Installation Tracking for AxonStream Packages
 * 
 * Automatically tracks package installations and usage for analytics
 * while respecting user privacy and providing opt-out mechanisms.
 */

export interface InstallationTrackingConfig {
  enabled: boolean;
  endpoint: string;
  packageName: string;
  packageVersion: string;
  sessionId?: string;
  userId?: string;
  organizationId?: string;
  optOut?: boolean;
}

export interface UsageTrackingData {
  feature: string;
  category: string;
  metadata?: Record<string, any>;
}

export class InstallationTracker {
  private config: InstallationTrackingConfig;
  private installationId?: string;
  private trackingEnabled: boolean;

  constructor(config: Partial<InstallationTrackingConfig> = {}) {
    this.config = {
      enabled: true,
      endpoint: 'https://api.axonstream.ai/api/v1/demo/installation/track',
      packageName: '@axonstream/sdk',
      packageVersion: '1.0.0',
      optOut: false,
      ...config,
    };

    // Check for opt-out environment variables
    this.trackingEnabled = this.config.enabled &&
      !this.config.optOut &&
      !this.isOptedOut();

    if (this.trackingEnabled) {
      this.trackInstallation();
    }
  }

  /**
   * Track package installation
   */
  private async trackInstallation(): Promise<void> {
    try {
      const installationData = {
        packageName: this.config.packageName,
        packageVersion: this.config.packageVersion,
        sessionId: this.config.sessionId,
        userId: this.config.userId,
        organizationId: this.config.organizationId,
        installedAt: new Date().toISOString(),
        environment: this.getEnvironmentInfo(),
        framework: this.detectFramework(),
        installationContext: this.getInstallationContext(),
      };

      const response = await this.makeRequest(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Package-Name': this.config.packageName,
          'X-Package-Version': this.config.packageVersion,
          'X-Installation-Tracking': 'true',
        },
        body: JSON.stringify(installationData),
      });

      if (response.ok) {
        const result = await response.json();
        this.installationId = result.installationId;

        // Store installation ID for future usage tracking
        if (typeof localStorage !== 'undefined' && this.installationId) {
          localStorage.setItem(
            `axonstream_installation_${this.config.packageName}`,
            this.installationId
          );
        }
      }
    } catch (error: any) {
      // Silently fail - don't break user's application
      console.debug('Installation tracking failed:', error?.message || 'Unknown error');
    }
  }

  /**
   * Track feature usage
   */
  async trackUsage(data: UsageTrackingData): Promise<void> {
    if (!this.trackingEnabled || !this.installationId) {
      return;
    }

    try {
      const usageData = {
        installationId: this.installationId,
        feature: data.feature,
        category: data.category,
        metadata: data.metadata,
        timestamp: new Date().toISOString(),
      };

      await this.makeRequest(`${this.config.endpoint}/usage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Installation-ID': this.installationId,
        },
        body: JSON.stringify(usageData),
      });
    } catch (error: any) {
      // Silently fail
      console.debug('Usage tracking failed:', error?.message || 'Unknown error');
    }
  }

  /**
   * Track package uninstallation
   */
  async trackUninstallation(): Promise<void> {
    if (!this.trackingEnabled || !this.installationId) {
      return;
    }

    try {
      await this.makeRequest(`${this.config.endpoint}/uninstall`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Installation-ID': this.installationId,
        },
        body: JSON.stringify({
          installationId: this.installationId,
          uninstalledAt: new Date().toISOString(),
        }),
      });

      // Clean up local storage
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(`axonstream_installation_${this.config.packageName}`);
      }
    } catch (error: any) {
      console.debug('Uninstallation tracking failed:', error?.message || 'Unknown error');
    }
  }

  /**
   * Opt out of tracking
   */
  optOut(): void {
    this.trackingEnabled = false;

    // Set opt-out flag
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('axonstream_tracking_opt_out', 'true');
    }

    // Track uninstallation if we were tracking
    if (this.installationId) {
      this.trackUninstallation();
    }
  }

  /**
   * Check if user has opted out
   */
  private isOptedOut(): boolean {
    // Check environment variables
    if (typeof process !== 'undefined' && process.env) {
      if (process.env.AXONSTREAM_TRACKING_OPT_OUT === 'true' ||
        process.env.DO_NOT_TRACK === '1' ||
        process.env.DNT === '1') {
        return true;
      }
    }

    // Check localStorage
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('axonstream_tracking_opt_out') === 'true';
    }

    return false;
  }

  /**
   * Get environment information
   */
  private getEnvironmentInfo(): Record<string, any> {
    const env: Record<string, any> = {};

    if (typeof process !== 'undefined' && process.versions) {
      env.nodeVersion = process.versions.node;
      env.v8Version = process.versions.v8;
    }

    if (typeof navigator !== 'undefined') {
      env.userAgent = navigator.userAgent;
      env.platform = navigator.platform;
      env.language = navigator.language;
    }

    if (typeof window !== 'undefined') {
      env.isBrowser = true;
      env.windowSize = {
        width: window.innerWidth,
        height: window.innerHeight,
      };
    } else {
      env.isBrowser = false;
    }

    return env;
  }

  /**
   * Detect framework being used
   */
  private detectFramework(): Record<string, any> {
    const framework: Record<string, any> = { type: 'unknown' };

    // Check for React
    if (typeof window !== 'undefined' && (window as any).React) {
      framework.type = 'react';
      framework.version = (window as any).React.version;
    }

    // Check for Vue
    if (typeof window !== 'undefined' && (window as any).Vue) {
      framework.type = 'vue';
      framework.version = (window as any).Vue.version;
    }

    // Check for Angular
    if (typeof window !== 'undefined' && (window as any).ng) {
      framework.type = 'angular';
    }

    // Check for Next.js
    if (typeof window !== 'undefined' && (window as any).__NEXT_DATA__) {
      framework.type = 'next';
      framework.ssr = true;
    }

    // Check for Nuxt.js
    if (typeof window !== 'undefined' && (window as any).__NUXT__) {
      framework.type = 'nuxt';
      framework.ssr = true;
    }

    return framework;
  }

  /**
   * Get installation context
   */
  private getInstallationContext(): Record<string, any> {
    const context: Record<string, any> = {};

    // Check if running in CI
    if (typeof process !== 'undefined' && process.env) {
      context.isCI = !!(
        process.env.CI ||
        process.env.CONTINUOUS_INTEGRATION ||
        process.env.GITHUB_ACTIONS ||
        process.env.TRAVIS ||
        process.env.JENKINS_URL
      );

      if (context.isCI) {
        context.ciProvider =
          process.env.GITHUB_ACTIONS ? 'github-actions' :
            process.env.TRAVIS ? 'travis' :
              process.env.JENKINS_URL ? 'jenkins' :
                'unknown';
      }
    }

    return context;
  }

  /**
   * Make HTTP request with timeout and error handling
   */
  private async makeRequest(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
}

// Global instance for easy access
let globalTracker: InstallationTracker | null = null;

/**
 * Initialize installation tracking
 */
export function initializeTracking(config?: Partial<InstallationTrackingConfig>): InstallationTracker {
  if (!globalTracker) {
    globalTracker = new InstallationTracker(config);
  }
  return globalTracker;
}

/**
 * Track feature usage (convenience function)
 */
export function trackUsage(feature: string, category: string, metadata?: Record<string, any>): void {
  if (globalTracker) {
    globalTracker.trackUsage({ feature, category, metadata });
  }
}

/**
 * Opt out of tracking (convenience function)
 */
export function optOutOfTracking(): void {
  if (globalTracker) {
    globalTracker.optOut();
  }
}

// Auto-initialize tracking when module is imported
if (typeof window !== 'undefined' || typeof process !== 'undefined') {
  initializeTracking();
}
