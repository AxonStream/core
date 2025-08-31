import chalk from 'chalk';
import ora from 'ora';
import { writeFileSync } from 'fs';
import { createAxonPulsClient } from '@axonstream/core';
import { getConfig } from '../utils/config';
import { validateToken } from '../utils/auth';
import { formatEvent } from '../utils/format';

export async function subscribeCommand(channels: string[], options?: any) {
    const spinner = ora('Setting up subscription...').start();

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

        let subscribed = false;
        let eventCount = 0;
        let fileStream: any = null;

        // Setup file saving if requested
        if (options.save) {
            fileStream = require('fs').createWriteStream(options.save, { flags: 'a' });
        }

        client.on('connected', async () => {
            try {
                spinner.text = `Subscribing to ${channels.length} channel(s)...`;

                // Subscribe options
                const subscribeOptions: any = {};
                if (options.replayFrom) {
                    subscribeOptions.replay_from = options.replayFrom;
                }
                if (options.replayCount) {
                    subscribeOptions.replay_count = parseInt(options.replayCount, 10);
                }
                if (options.filter) {
                    subscribeOptions.filter = options.filter;
                }

                await client.subscribe(channels, subscribeOptions);
                subscribed = true;

                spinner.succeed('Subscribed successfully!');

                console.log();
                console.log(chalk.green('✓ Listening for events'));
                console.log(chalk.blue('ℹ Subscription details:'));
                console.log(`  Channels: ${chalk.cyan(channels.join(', '))}`);
                const organizationId = tokenInfo.payload?.organizationId || tokenInfo.payload?.orgId;
                console.log(`  Organization: ${chalk.cyan(organizationId)}`);
                console.log(`  Output format: ${chalk.cyan(options.output || 'json')}`);

                if (options.replayFrom) {
                    console.log(`  Replay from: ${chalk.cyan(options.replayFrom)}`);
                }
                if (options.replayCount) {
                    console.log(`  Replay count: ${chalk.cyan(options.replayCount)}`);
                }
                if (options.filter) {
                    console.log(`  Filter: ${chalk.cyan(options.filter)}`);
                }
                if (options.save) {
                    console.log(`  Saving to: ${chalk.cyan(options.save)}`);
                }

                console.log();
                console.log(chalk.yellow('Press Ctrl+C to stop listening'));
                console.log(chalk.gray('━'.repeat(80)));

            } catch (error: any) {
                spinner.fail('Subscription failed');
                console.error(chalk.red(`Subscribe error: ${error.message}`));
                process.exit(1);
            }
        });

        // Handle incoming events
        client.on('event', (event: any) => {
            eventCount++;

            // Apply filter if specified
            if (options.filter) {
                const filterMatches = event.type.includes(options.filter) ||
                    JSON.stringify(event.payload).includes(options.filter);
                if (!filterMatches) {
                    return;
                }
            }

            // Format and display event
            const formattedEvent = formatEvent(event, options.output || 'json');

            console.log(chalk.cyan(`[${new Date().toISOString()}] Event ${eventCount}:`));
            console.log(formattedEvent);
            console.log(chalk.gray('─'.repeat(40)));

            // Save to file if requested
            if (fileStream) {
                fileStream.write(JSON.stringify(event) + '\n');
            }
        });

        client.on('error', (error: Error) => {
            if (!subscribed) {
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

            if (fileStream) {
                fileStream.end();
            }

            if (subscribed) {
                try {
                    await client.unsubscribe(channels);
                } catch (error) {
                    // Ignore unsubscribe errors during shutdown
                }
            }

            await client.disconnect();

            console.log(chalk.green(`\n✓ Disconnected. Total events received: ${eventCount}`));
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
