import { table } from 'table';
import chalk from 'chalk';

export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));

    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

export function formatDuration(milliseconds: number): string {
    if (milliseconds < 1000) {
        return `${milliseconds}ms`;
    }

    const seconds = milliseconds / 1000;
    if (seconds < 60) {
        return `${seconds.toFixed(1)}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    return `${minutes}m ${remainingSeconds}s`;
}

export function formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
}

export function formatEvent(event: any, format: 'json' | 'table' | 'raw' = 'json'): string {
    switch (format) {
        case 'json':
            return JSON.stringify(event, null, 2);

        case 'table':
            const rows = [
                ['Field', 'Value'],
                ['ID', event.id || 'N/A'],
                ['Type', event.type || 'N/A'],
                ['Timestamp', formatTimestamp(event.timestamp)],
                ['Channel', event.metadata?.channel || 'N/A'],
                ['Org ID', event.metadata?.org_id || 'N/A'],
                ['Correlation ID', event.metadata?.correlation_id || 'N/A'],
                ['Payload', JSON.stringify(event.payload, null, 2)],
            ];

            return table(rows, {
                border: {
                    topBody: `─`,
                    topJoin: `┬`,
                    topLeft: `┌`,
                    topRight: `┐`,
                    bottomBody: `─`,
                    bottomJoin: `┴`,
                    bottomLeft: `└`,
                    bottomRight: `┘`,
                    bodyLeft: `│`,
                    bodyRight: `│`,
                    bodyJoin: `│`,
                    joinBody: `─`,
                    joinLeft: `├`,
                    joinRight: `┤`,
                    joinJoin: `┼`
                }
            });

        case 'raw':
            return `[${formatTimestamp(event.timestamp)}] ${event.type}: ${JSON.stringify(event.payload)}`;

        default:
            return JSON.stringify(event, null, 2);
    }
}

export function formatConnectionStatus(status: string): string {
    switch (status) {
        case 'connected':
            return chalk.green('● Connected');
        case 'connecting':
            return chalk.yellow('● Connecting');
        case 'disconnected':
            return chalk.red('● Disconnected');
        case 'reconnecting':
            return chalk.yellow('● Reconnecting');
        default:
            return chalk.gray(`● ${status}`);
    }
}

export function formatMetrics(metrics: any): string {
    const rows = [
        ['Metric', 'Value'],
    ];

    if (metrics.connections !== undefined) {
        rows.push(['Active Connections', String(metrics.connections)]);
    }

    if (metrics.events !== undefined) {
        rows.push(['Events/sec', String(metrics.events)]);
    }

    if (metrics.errors !== undefined) {
        rows.push(['Errors/min', String(metrics.errors)]);
    }

    if (metrics.latency !== undefined) {
        rows.push(['Avg Latency', `${metrics.latency}ms`]);
    }

    if (metrics.memory !== undefined) {
        rows.push(['Memory Usage', formatBytes(metrics.memory)]);
    }

    if (metrics.uptime !== undefined) {
        rows.push(['Uptime', formatDuration(metrics.uptime)]);
    }

    return table(rows, {
        columns: {
            1: { alignment: 'right' }
        }
    });
}

export function truncateText(text: string, maxLength: number = 50): string {
    if (text.length <= maxLength) {
        return text;
    }

    return text.substring(0, maxLength - 3) + '...';
}
