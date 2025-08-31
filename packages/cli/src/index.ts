/**
 * CLI Package Exports
 * This file provides exports for testing and integration purposes
 */

// Export the main CLI program
export { program } from './cli';

// Export command functions for testing
export { connectCommand } from './commands/connect';
export { publishCommand } from './commands/publish';
export { subscribeCommand } from './commands/subscribe';
export { replayCommand } from './commands/replay';
export { monitorCommand } from './commands/monitor';
export { authCommand } from './commands/auth';
export { configCommand } from './commands/config';
export { testCommand } from './commands/test';

// Export utility functions
export { getConfig, setConfig, getConfigValue, listConfig, resetConfig } from './utils/config';
export { validateToken, displayTokenInfo, getTokenOrgId } from './utils/auth';
export { formatEvent, formatBytes, formatDuration, formatTimestamp, formatConnectionStatus, formatMetrics, truncateText } from './utils/format';

// Export types and interfaces
export type { CliConfig } from './utils/config';
export type { TokenValidationResult, AxonPulsJwtPayload } from './utils/auth';
export type { DashboardOptions, DashboardData } from './ui/dashboard';
