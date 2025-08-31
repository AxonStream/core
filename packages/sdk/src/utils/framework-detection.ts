/**
 * Framework Detection Utilities (Hardened)
 * - SSR-safe checks
 * - No timers keeping the process alive
 * - Optional require via eval to avoid bundler rewrites
 * - Improved DOM signals (+ Svelte)
 */

export interface FrameworkInfo {
  name: string;
  version?: string;
  detected: boolean;
  confidence: number; // 0..1
  method: 'global' | 'require' | 'package' | 'dom' | 'userAgent';
  timestamp: number;
}

export interface FrameworkDetectionOptions {
  enableCaching?: boolean;      // default: true
  cacheTimeout?: number;        // default: 60_000 ms
  enableVersionDetection?: boolean; // default: true
  enableConfidenceScoring?: boolean; // reserved (kept for compat)
  fallbackToUserAgent?: boolean;    // default: true
}

const DEFAULT_CACHE_TIMEOUT = 60_000;

type CacheEntry = { info: FrameworkInfo; expiresAt: number };
const detectionCache = new Map<string, CacheEntry>();

// Environment guards
const hasWindow = typeof window !== 'undefined';
const hasDoc = typeof document !== 'undefined';
const hasNavigator = typeof navigator !== 'undefined';
const gAny = (typeof globalThis !== 'undefined' ? (globalThis as any) : {}) as any;

function now() { return Date.now(); }

function safeRequire<T = any>(id: string): T | null {
  try {
    // Use dynamic import or global require if available
    if (typeof require !== 'undefined') {
      return require(id) as T;
    }
    // Check if require is available in global scope (Node.js)
    if (typeof global !== 'undefined' && (global as any).require) {
      return (global as any).require(id) as T;
    }
  } catch { /* ignore */ }
  return null;
}

function getPkgVersion(pkgName: string): string | undefined {
  const pkg = safeRequire<{ version?: string }>(`${pkgName}/package.json`);
  return pkg?.version;
}

function newInfo(
  name: string,
  method: FrameworkInfo['method'] = 'global',
  confidence = 0
): FrameworkInfo {
  return {
    name,
    detected: false,
    confidence,
    method,
    timestamp: now()
  };
}

function cacheGet(key: string, timeout?: number): FrameworkInfo | null {
  const entry = detectionCache.get(key);
  if (!entry) return null;
  const ttl = timeout ?? DEFAULT_CACHE_TIMEOUT;
  if (now() > entry.expiresAt) { detectionCache.delete(key); return null; }
  return entry.info;
}

function cacheSet(key: string, info: FrameworkInfo, timeout?: number) {
  const ttl = timeout ?? DEFAULT_CACHE_TIMEOUT;
  detectionCache.set(key, { info, expiresAt: now() + ttl });
}

/* -------------------- React -------------------- */

export function detectReact(options: FrameworkDetectionOptions = {}): FrameworkInfo {
  const {
    enableCaching = true,
    cacheTimeout,
    enableVersionDetection = true,
    fallbackToUserAgent = true,
  } = options;

  const cacheKey = 'react';
  if (enableCaching) {
    const c = cacheGet(cacheKey, cacheTimeout);
    if (c) return c;
  }

  const info = newInfo('React');

  try {
    // 1) Global hooks / objects
    if (hasWindow && (gAny.React || gAny.__REACT_DEVTOOLS_GLOBAL_HOOK__)) {
      info.detected = true;
      info.method = 'global';
      info.confidence = gAny.React ? 0.9 : 0.75;
      if (enableVersionDetection) {
        info.version = gAny.React?.version ?? getPkgVersion('react');
      }
    }
    // 2) Optional require
    else {
      const React = safeRequire<any>('react');
      if (React) {
        info.detected = true;
        info.method = 'require';
        info.confidence = 0.85;
        info.version = React.version ?? (enableVersionDetection ? getPkgVersion('react') : undefined);
      }
      // 3) DOM signals (lower confidence)
      else if (hasDoc) {
        const hasReactRoot = document.querySelector('[data-reactroot]');
        const isNextRoot = document.getElementById('__next'); // Next.js uses React
        if (hasReactRoot || isNextRoot) {
          info.detected = true;
          info.method = 'dom';
          info.confidence = hasReactRoot ? 0.6 : 0.5;
        }
        // 4) User-agent fallback for React Native
        else if (fallbackToUserAgent && hasNavigator && navigator.userAgent.includes('ReactNative')) {
          info.detected = true;
          info.method = 'userAgent';
          info.confidence = 0.4;
        }
      }
    }
  } catch { /* swallow */ }

  if (enableCaching) cacheSet(cacheKey, info, cacheTimeout);
  return info;
}

/* -------------------- Vue -------------------- */

export function detectVue(options: FrameworkDetectionOptions = {}): FrameworkInfo {
  const {
    enableCaching = true, cacheTimeout, enableVersionDetection = true,
  } = options;

  const cacheKey = 'vue';
  if (enableCaching) {
    const c = cacheGet(cacheKey, cacheTimeout);
    if (c) return c;
  }

  const info = newInfo('Vue');

  try {
    // 1) Globals/devtools
    if (hasWindow && (gAny.Vue || gAny.__VUE_DEVTOOLS_GLOBAL_HOOK__ || gAny.__VUE__)) {
      info.detected = true;
      info.method = 'global';
      info.confidence = gAny.Vue ? 0.9 : 0.75;
      if (enableVersionDetection) {
        info.version = gAny.Vue?.version ?? getPkgVersion('vue');
      }
    } else {
      // 2) Optional require
      const Vue = safeRequire<any>('vue');
      if (Vue) {
        info.detected = true;
        info.method = 'require';
        info.confidence = 0.85;
        info.version = Vue.version ?? (enableVersionDetection ? getPkgVersion('vue') : undefined);
      }
      // 3) DOM: Vue 3 sets data-v-app; scoped CSS adds data-v-xxxx
      else if (hasDoc) {
        const vueNodes = document.querySelector('[data-v-app]') ||
          document.querySelector('[data-v-]');
        if (vueNodes) {
          info.detected = true;
          info.method = 'dom';
          info.confidence = 0.6;
        }
      }
    }
  } catch { /* swallow */ }

  if (enableCaching) cacheSet(cacheKey, info, cacheTimeout);
  return info;
}

/* -------------------- Angular -------------------- */

export function detectAngular(options: FrameworkDetectionOptions = {}): FrameworkInfo {
  const {
    enableCaching = true, cacheTimeout, enableVersionDetection = true,
  } = options;

  const cacheKey = 'angular';
  if (enableCaching) {
    const c = cacheGet(cacheKey, cacheTimeout);
    if (c) return c;
  }

  const info = newInfo('Angular');

  try {
    // 1) Global window.ng* (dev mode) or window.angular (AngularJS)
    if (hasWindow && (gAny.ng || gAny.angular)) {
      info.detected = true;
      info.method = 'global';
      info.confidence = 0.9;
      if (enableVersionDetection) {
        info.version =
          gAny.ng?.version?.full ||
          gAny.angular?.version?.full ||
          getPkgVersion('@angular/core');
      }
    } else {
      // 2) Optional require of Angular core is not super useful, prefer package.json
      const ngCoreVersion = enableVersionDetection ? getPkgVersion('@angular/core') : undefined;
      if (ngCoreVersion) {
        info.detected = true;
        info.method = 'package';
        info.confidence = 0.8;
        info.version = ngCoreVersion;
      }
      // 3) DOM: Angular adds [ng-version] on root element in prod
      else if (hasDoc) {
        const ngRoot = document.querySelector('[ng-version]');
        if (ngRoot) {
          info.detected = true;
          info.method = 'dom';
          info.confidence = 0.7;
          info.version = (ngRoot as HTMLElement).getAttribute('ng-version') ?? undefined;
        }
      }
    }
  } catch { /* swallow */ }

  if (enableCaching) cacheSet(cacheKey, info, cacheTimeout);
  return info;
}

/* -------------------- Svelte (extra) -------------------- */

export function detectSvelte(options: FrameworkDetectionOptions = {}): FrameworkInfo {
  const {
    enableCaching = true, cacheTimeout, enableVersionDetection = true,
  } = options;

  const cacheKey = 'svelte';
  if (enableCaching) {
    const c = cacheGet(cacheKey, cacheTimeout);
    if (c) return c;
  }

  const info = newInfo('Svelte');

  try {
    // Svelte is a compiler; rely on DOM signals + package.json for version
    if (hasDoc) {
      const svelteEl =
        document.querySelector('[data-svelte-h]') ||  // hydration marker
        document.querySelector('[data-svelte]') ||
        document.querySelector('[data-sveltekit]');

      if (svelteEl) {
        info.detected = true;
        info.method = 'dom';
        info.confidence = 0.7;
      }
    }

    if (!info.detected) {
      const v = enableVersionDetection ? getPkgVersion('svelte') : undefined;
      if (v) {
        info.detected = true;
        info.method = 'package';
        info.confidence = 0.6; // present in deps; still not guaranteed in runtime
        info.version = v;
      }
    } else if (enableVersionDetection) {
      info.version = getPkgVersion('svelte');
    }
  } catch { /* swallow */ }

  if (enableCaching) cacheSet(cacheKey, info, cacheTimeout);
  return info;
}

/* -------------------- Bulk & helpers -------------------- */

export function detectAllFrameworks(options: FrameworkDetectionOptions = {}): {
  react: FrameworkInfo;
  vue: FrameworkInfo;
  angular: FrameworkInfo;
  // keep return type compatible; svelte available via detectSvelte()
  primary?: FrameworkInfo;
} {
  const react = detectReact(options);
  const vue = detectVue(options);
  const angular = detectAngular(options);

  let primary: FrameworkInfo | undefined;
  [react, vue, angular].forEach(f => {
    if (f.detected && (!primary || f.confidence > primary.confidence)) primary = f;
  });

  return { react, vue, angular, primary };
}

export function isReactEnvironment(): boolean { return detectReact({ enableCaching: true }).detected; }
export function isVueEnvironment(): boolean { return detectVue({ enableCaching: true }).detected; }
export function isAngularEnvironment(): boolean { return detectAngular({ enableCaching: true }).detected; }
export function isSvelteEnvironment(): boolean { return detectSvelte({ enableCaching: true }).detected; }

export function getPrimaryFramework(options?: FrameworkDetectionOptions): FrameworkInfo | null {
  const { primary } = detectAllFrameworks(options ?? {});
  return primary ?? null;
}

export function clearDetectionCache(): void {
  detectionCache.clear();
}

export function getDetectionCacheStats(): {
  size: number;
  keys: string[];
  oldestTimestamp: number;
  newestTimestamp: number;
  expiresInMs: Record<string, number>;
} {
  const entries = Array.from(detectionCache.entries());
  const timestamps = entries.map(([, e]) => e.info.timestamp);
  const expiresInMs: Record<string, number> = {};
  const t = now();
  for (const [k, e] of entries) expiresInMs[k] = Math.max(0, e.expiresAt - t);
  return {
    size: detectionCache.size,
    keys: entries.map(([k]) => k),
    oldestTimestamp: timestamps.length ? Math.min(...timestamps) : 0,
    newestTimestamp: timestamps.length ? Math.max(...timestamps) : 0,
    expiresInMs
  };
}
