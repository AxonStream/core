import chalk from 'chalk';
import ora from 'ora';
import { createAxonPulsClient } from '@axonstream/core';
import { getConfig } from '../utils/config';
import { validateToken } from '../utils/auth';
import { formatEvent } from '../utils/format';

export async function replayCommand(channel: string, options?: any) {
    const spinner = ora('Setting up event replay...').start();

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

        let replaying = false;
        let eventCount = 0;

        client.on('connected', async () => {
            try {
                spinner.text = `Starting replay for channel: ${channel}`;

                // Replay options
                const replayOptions: any = {};
                if (options.since) {
                    replayOptions.replay_from = options.since;
                }
                if (options.count) {
                    replayOptions.replay_count = parseInt(options.count, 10);
                }

                // Use subscribe with replay options instead of non-existent replay method
                await client.subscribe([channel], replayOptions);
                replaying = true;

                spinner.succeed('Event replay started!');

                console.log();
                console.log(chalk.green('✓ Replaying events'));
                console.log(chalk.blue('ℹ Replay details:'));
                console.log(`  Channel: ${chalk.cyan(channel)}`);
                const organizationId = tokenInfo.payload?.organizationId || tokenInfo.payload?.orgId;
                console.log(`  Organization: ${chalk.cyan(organizationId)}`);

                if (options.since) {
                    console.log(`  Since: ${chalk.cyan(options.since)}`);
                }
                if (options.count) {
                    console.log(`  Count: ${chalk.cyan(options.count)}`);
                }

                console.log();
                console.log(chalk.yellow('Press Ctrl+C to stop replay'));
                console.log(chalk.gray('━'.repeat(80)));

            } catch (error: any) {
                spinner.fail('Replay failed');
                console.error(chalk.red(`Replay error: ${error.message}`));
                process.exit(1);
            }
        });

        // Handle replayed events
        client.on('event', (event: any) => {
            eventCount++;

            // Format and display event
            const formattedEvent = formatEvent(event, options.output || 'json');

            console.log(chalk.cyan(`[REPLAY ${eventCount}] ${new Date(event.timestamp).toISOString()}:`));
            console.log(formattedEvent);
            console.log(chalk.gray('─'.repeat(40)));
        });

        client.on('error', (error: Error) => {
            if (!replaying) {
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
            console.log(chalk.yellow('\nShutting down...'));
            await client.disconnect();
            console.log(chalk.green(`\n✓ Disconnected. Total events replayed: ${eventCount}`));
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
