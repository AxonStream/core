import chalk from 'chalk';
import ora from 'ora';
import { createAxonPulsClient } from '@axonstream/core';
import { getConfig } from '../utils/config';
import { validateToken } from '../utils/auth';

export async function testCommand(command: any, options?: any) {
    console.log(chalk.bold.blue('🧪 AxonPuls Platform Test Suite'));
    console.log(chalk.gray('━'.repeat(50)));

    if (command === 'connection' || !command) {
        await testConnection(options);
    }

    if (command === 'auth' || !command) {
        await testAuthentication(options);
    }

    if (command === 'messaging' || !command) {
        await testMessaging(options);
    }

    console.log();
    console.log(chalk.green('✅ All tests completed!'));
}

async function testConnection(options?: any) {
    const spinner = ora('Testing connection...').start();

    try {
        const config = await getConfig();
        const url = config.gateway_url || process.env.AxonPuls_GATEWAY_URL;
        const token = config.token || process.env.AxonPuls_TOKEN;

        if (!url || !token) {
            spinner.fail('Configuration test failed');
            console.error(chalk.red('❌ Gateway URL and token are required'));
            return;
        }

        spinner.text = 'Connecting to gateway...';

        const client = createAxonPulsClient({
            url,
            token,
            autoReconnect: false,
            debug: options?.verbose,
        });

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Connection timeout'));
            }, 10000);

            client.on('connected', () => {
                clearTimeout(timeout);
                resolve();
            });

            client.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });

            client.connect();
        });

        await client.disconnect();
        spinner.succeed('Connection test passed');
        console.log(chalk.green('✅ Connection: OK'));

    } catch (error: any) {
        spinner.fail('Connection test failed');
        console.log(chalk.red(`❌ Connection: ${error.message}`));
    }
}

async function testAuthentication(options?: any) {
    const spinner = ora('Testing authentication...').start();

    try {
        const config = await getConfig();
        const token = config.token || process.env.AxonPuls_TOKEN;

        if (!token) {
            spinner.fail('Authentication test failed');
            console.log(chalk.red('❌ Authentication: No token provided'));
            return;
        }

        const tokenInfo = validateToken(token);
        if (!tokenInfo.valid) {
            spinner.fail('Authentication test failed');
            console.log(chalk.red(`❌ Authentication: ${tokenInfo.error}`));
            return;
        }

        spinner.succeed('Authentication test passed');
        console.log(chalk.green('✅ Authentication: OK'));
        console.log(chalk.blue(`   Organization: ${tokenInfo.payload.organizationId}`));
        console.log(chalk.blue(`   User: ${tokenInfo.payload.sub}`));

    } catch (error: any) {
        spinner.fail('Authentication test failed');
        console.log(chalk.red(`❌ Authentication: ${error.message}`));
    }
}

async function testMessaging(options?: any) {
    const spinner = ora('Testing messaging...').start();

    try {
        const config = await getConfig();
        const url = config.gateway_url || process.env.AxonPuls_GATEWAY_URL;
        const token = config.token || process.env.AxonPuls_TOKEN;

        if (!url || !token) {
            spinner.fail('Messaging test failed');
            console.log(chalk.red('❌ Messaging: Missing configuration'));
            return;
        }

        const client = createAxonPulsClient({
            url,
            token,
            autoReconnect: false,
            debug: options?.verbose,
        });

        let messageReceived = false;
        const testChannel = `test-${Date.now()}`;
        const testMessage = {
            type: 'test-event',
            payload: { message: 'Hello from CLI test', timestamp: Date.now() }
        };

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Messaging test timeout'));
            }, 15000);

            client.on('connected', async () => {
                try {
                    spinner.text = 'Testing subscription...';

                    // Subscribe to test channel
                    await client.subscribe([testChannel]);

                    spinner.text = 'Testing publish...';

                    // Set up event listener
                    client.on('event', (event) => {
                        if (event.type === testMessage.type && event.payload.message === testMessage.payload.message) {
                            messageReceived = true;
                            clearTimeout(timeout);
                            resolve();
                        }
                    });

                    // Publish test message
                    await client.publish(testChannel, testMessage);

                } catch (error) {
                    clearTimeout(timeout);
                    reject(error);
                }
            });

            client.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });

            client.connect();
        });

        await client.disconnect();

        if (messageReceived) {
            spinner.succeed('Messaging test passed');
            console.log(chalk.green('✅ Messaging: OK'));
            console.log(chalk.blue(`   Test channel: ${testChannel}`));
            console.log(chalk.blue('   Publish/Subscribe: Working'));
        } else {
            spinner.fail('Messaging test failed');
            console.log(chalk.red('❌ Messaging: Message not received'));
        }

    } catch (error: any) {
        spinner.fail('Messaging test failed');
        console.log(chalk.red(`❌ Messaging: ${error.message}`));
    }
}
