import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { readFileSync } from 'fs';
import { createAxonPulsClient } from '@axonstream/core';
import { getConfig } from '../utils/config';
import { validateToken } from '../utils/auth';
import { formatBytes } from '../utils/format';

export async function publishCommand(channel: string, type: string, payload?: string, options?: any) {
  const spinner = ora('Publishing event...').start();

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

    spinner.text = 'Preparing payload...';

    // Determine payload source
    let eventPayload: any;

    if (options.interactive) {
      spinner.stop();
      const answers = await inquirer.prompt([
        {
          type: 'editor',
          name: 'payload',
          message: 'Enter event payload (JSON):',
          default: '{\n  \n}',
        },
      ]);
      eventPayload = JSON.parse(answers.payload);
      spinner.start('Publishing event...');
    } else if (options.file) {
      const fileContent = readFileSync(options.file, 'utf-8');
      eventPayload = JSON.parse(fileContent);
    } else if (payload) {
      eventPayload = JSON.parse(payload);
    } else {
      eventPayload = {};
    }

    // Validate payload size
    const payloadJson = JSON.stringify(eventPayload);
    const payloadSize = Buffer.byteLength(payloadJson, 'utf8');

    if (payloadSize > 1048576) { // 1MB
      spinner.fail('Payload too large');
      console.error(chalk.red(`Payload size (${formatBytes(payloadSize)}) exceeds 1MB limit`));
      process.exit(1);
    }

    spinner.text = `Connecting to gateway...`;

    // Create client
    const client = createAxonPulsClient({
      url,
      token,
      autoReconnect: false,
      debug: options.verbose,
    });

    let publishSuccessful = false;

    client.on('connected', async () => {
      try {
        spinner.text = `Publishing to ${channel}...`;

        // Publish options
        const publishOptions: any = {};
        if (options.delivery) {
          publishOptions.delivery_guarantee = options.delivery;
        }
        if (options.partitionKey) {
          publishOptions.partition_key = options.partitionKey;
        }

        // Publish event
        await client.publish(channel, {
          type,
          payload: eventPayload,
        }, publishOptions);

        publishSuccessful = true;
        spinner.succeed('Event published successfully!');

        console.log();
        console.log(chalk.green('✓ Event published'));
        console.log(chalk.blue('ℹ Event details:'));
        console.log(`  Channel: ${chalk.cyan(channel)}`);
        console.log(`  Type: ${chalk.cyan(type)}`);
        console.log(`  Size: ${chalk.cyan(formatBytes(payloadSize))}`);
        console.log(`  Organization: ${chalk.cyan(tokenInfo.payload.organizationId)}`);

        if (options.delivery) {
          console.log(`  Delivery guarantee: ${chalk.cyan(options.delivery)}`);
        }
        if (options.partitionKey) {
          console.log(`  Partition key: ${chalk.cyan(options.partitionKey)}`);
        }

        console.log(chalk.blue('ℹ Payload:'));
        console.log(chalk.gray(JSON.stringify(eventPayload, null, 2)));

        await client.disconnect();
        process.exit(0);

      } catch (error: any) {
        spinner.fail('Publishing failed');
        console.error(chalk.red(`Publish error: ${error.message}`));
        await client.disconnect();
        process.exit(1);
      }
    });

    client.on('error', (error: Error) => {
      if (!publishSuccessful) {
        spinner.fail('Connection failed');
        console.error(chalk.red(`Connection error: ${error.message}`));
        process.exit(1);
      }
    });

    // Connect with timeout
    const timeout = setTimeout(() => {
      if (!publishSuccessful) {
        spinner.fail('Connection timeout');
        console.error(chalk.red('Connection timed out'));
        process.exit(1);
      }
    }, 10000);

    await client.connect();
    clearTimeout(timeout);

  } catch (error: any) {
    spinner.fail('Publishing failed');

    if (error.name === 'SyntaxError') {
      console.error(chalk.red('Invalid JSON payload:'), error.message);
    } else {
      console.error(chalk.red(`Error: ${error.message}`));
    }

    process.exit(1);
  }
}
