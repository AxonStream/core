import chalk from 'chalk';
import ora from 'ora';
import { createAxonPulsClient } from '@axonstream/core';
import { getConfig } from '../utils/config';
import { validateToken } from '../utils/auth';
import { formatEvent, formatBytes, formatDuration } from '../utils/format';

export async function monitorCommand(options?: any) {
    const spinner = ora('Setting up monitoring...').start();

    try {
        // Get configuration
        const config = await getConfig();
        const url = config.gateway_url || process.env.AxonPuls_GATEWAY_URL;
        const token = config.token || process.env.AxonPuls_TOKEN;

        if (!url || !token) {
            spinner.fail('Missing configuration');
            console.error(chalk.red('Error: Gateway URL and token are required'));
            console.log(chalk.yellow('Use: AxonPuls config set gateway_url <url> && AxonPuls config set token <token>'));
            process.exit(1);
        }

        // Validate token
        const tokenInfo = validateToken(token);
        if (!tokenInfo.valid) {
            spinner.fail('Invalid token');
            console.error(chalk.red(`Token validation failed: ${tokenInfo.error}`));
            process.exit(1);
        }

        spinner.text = 'Connecting to gateway...';

        // Create client
        const client = createAxonPulsClient({
            url,
            token,
            autoReconnect: true,
            debug: options.verbose,
        });

        let monitoring = false;
        let stats = {
            totalEvents: 0,
            eventsByType: {} as Record<string, number>,
            eventsByChannel: {} as Record<string, number>,
            startTime: Date.now(),
            lastEventTime: 0,
            dataTransferred: 0,
            averageLatency: 0,
            connectionUptime: 0
        };

        // Display stats periodically
        let statsInterval: NodeJS.Timeout;
        const organizationId = tokenInfo.payload?.organizationId || tokenInfo.payload?.orgId;

        const displayStats = () => {
            console.clear();
            console.log(chalk.bold.blue('🔍 AxonPuls Platform Monitor'));
            console.log(chalk.gray('━'.repeat(60)));

            const uptime = Date.now() - stats.startTime;
            const eventsPerSecond = stats.totalEvents / (uptime / 1000);

            console.log(chalk.green('📊 Real-time Statistics:'));
            console.log(`  Total Events: ${chalk.cyan(stats.totalEvents.toString())}`);
            console.log(`  Events/sec: ${chalk.cyan(eventsPerSecond.toFixed(2))}`);
            console.log(`  Data Transferred: ${chalk.cyan(formatBytes(stats.dataTransferred))}`);
            console.log(`  Uptime: ${chalk.cyan(formatDuration(uptime))}`);
            console.log(`  Organization: ${chalk.cyan(organizationId)}`);

            if (stats.lastEventTime) {
                const timeSinceLastEvent = Date.now() - stats.lastEventTime;
                console.log(`  Last Event: ${chalk.cyan(formatDuration(timeSinceLastEvent))} ago`);
            }

            console.log();
            console.log(chalk.green('📈 Events by Type:'));
            Object.entries(stats.eventsByType)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10)
                .forEach(([type, count]) => {
                    const percentage = ((count / stats.totalEvents) * 100).toFixed(1);
                    console.log(`  ${type}: ${chalk.cyan(count.toString())} (${chalk.gray(percentage + '%')})`);
                });

            console.log();
            console.log(chalk.green('📡 Events by Channel:'));
            Object.entries(stats.eventsByChannel)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10)
                .forEach(([channel, count]) => {
                    const percentage = ((count / stats.totalEvents) * 100).toFixed(1);
                    console.log(`  ${channel}: ${chalk.cyan(count.toString())} (${chalk.gray(percentage + '%')})`);
                });

            console.log();
            console.log(chalk.yellow('Press Ctrl+C to stop monitoring'));
        };

        client.on('connected', async () => {
            try {
                spinner.text = 'Starting monitoring...';

                // Subscribe to all channels if none specified
                const channels = options.channels ? options.channels.split(',') : ['*'];

                await client.subscribe(channels, {
                    replay_from: options.since || '0'
                });

                monitoring = true;
                spinner.succeed('Monitoring started!');

                console.log();
                console.log(chalk.green('✓ Real-time monitoring active'));
                console.log(chalk.blue('ℹ Monitoring details:'));
                console.log(`  Channels: ${chalk.cyan(channels.join(', '))}`);
                console.log(`  Organization: ${chalk.cyan(organizationId)}`);

                if (options.since) {
                    console.log(`  Since: ${chalk.cyan(options.since)}`);
                }

                console.log();
                console.log(chalk.gray('━'.repeat(60)));

                // Start periodic stats display
                stats.startTime = Date.now();
                statsInterval = setInterval(displayStats, options.interval || 2000);
                displayStats();

            } catch (error: any) {
                spinner.fail('Monitoring failed');
                console.error(chalk.red(`Monitor error: ${error.message}`));
                process.exit(1);
            }
        });

        // Handle incoming events
        client.on('event', (event: any) => {
            stats.totalEvents++;
            stats.lastEventTime = Date.now();

            // Track by type
            const eventType = event.type || 'unknown';
            stats.eventsByType[eventType] = (stats.eventsByType[eventType] || 0) + 1;

            // Track by channel
            const channel = event.metadata?.channel || 'unknown';
            stats.eventsByChannel[channel] = (stats.eventsByChannel[channel] || 0) + 1;

            // Estimate data size
            const eventSize = JSON.stringify(event).length;
            stats.dataTransferred += eventSize;

            // Show individual events if requested
            if (options.verbose) {
                console.log(chalk.cyan(`[${new Date().toISOString()}] ${eventType}:`));
                console.log(formatEvent(event, 'json'));
                console.log(chalk.gray('─'.repeat(40)));
            }
        });

        client.on('error', (error: Error) => {
            if (!monitoring) {
                spinner.fail('Connection failed');
                console.error(chalk.red(`Connection error: ${error.message}`));
                process.exit(1);
            } else {
                console.error(chalk.red(`Error: ${error.message}`));
            }
        });

        client.on('disconnected', () => {
            console.log(chalk.yellow('\nConnection lost. Attempting to reconnect...'));
        });

        client.on('reconnecting', ({ attempt, delay }: any) => {
            console.log(chalk.yellow(`Reconnection attempt ${attempt} in ${delay}ms...`));
        });

        // Graceful shutdown
        process.on('SIGINT', async () => {
            console.log(chalk.yellow('\nShutting down monitor...'));

            if (statsInterval) {
                clearInterval(statsInterval);
            }

            await client.disconnect();

            console.log();
            console.log(chalk.green('📊 Final Statistics:'));
            console.log(`  Total Events: ${chalk.cyan(stats.totalEvents.toString())}`);
            console.log(`  Total Data: ${chalk.cyan(formatBytes(stats.dataTransferred))}`);
            console.log(`  Session Duration: ${chalk.cyan(formatDuration(Date.now() - stats.startTime))}`);
            console.log(chalk.green('\n✓ Monitoring stopped'));
            process.exit(0);
        });

        // Connect
        await client.connect();

    } catch (error: any) {
        spinner.fail('Setup failed');
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
    }
}
