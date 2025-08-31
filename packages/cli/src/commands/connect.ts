import chalk from 'chalk';
import ora from 'ora';
import { createAxonPulsClient } from '@axonstream/core';
import { getConfig } from '../utils/config';
import { validateToken } from '../utils/auth';

export async function connectCommand(options: any) {
  const spinner = ora('Testing connection to AxonStream gateway...').start();

  try {
    // Get configuration
    const config = await getConfig();
    const url = options.url || config.gateway_url || process.env.AXONSTREAM_GATEWAY_URL;
    const token = options.token || config.token || process.env.AXONSTREAM_TOKEN;
    const orgId = options.org || config.organization_id || process.env.AXONSTREAM_ORG_ID;

    if (!url || !token) {
      spinner.fail('Missing required configuration');
      console.error(chalk.red('Error: Gateway URL and token are required'));
      console.log(chalk.yellow('Set them using:'));
      console.log(chalk.cyan('  axonstream config set gateway_url <url>'));
      console.log(chalk.cyan('  axonstream config set token <token>'));
      console.log(chalk.yellow('Or use environment variables:'));
      console.log(chalk.cyan('  AXONSTREAM_GATEWAY_URL=<url>'));
      console.log(chalk.cyan('  AXONSTREAM_TOKEN=<token>'));
      process.exit(1);
    }

    // Validate token
    const tokenInfo = validateToken(token);
    if (!tokenInfo.valid || !tokenInfo.payload) {
      spinner.fail('Invalid token');
      console.error(chalk.red(`Token validation failed: ${tokenInfo.error}`));
      process.exit(1);
    }

    const organizationId = tokenInfo.payload.organizationId || tokenInfo.payload.orgId;
    spinner.text = `Connecting to ${url} for org ${organizationId}...`;

    // Create client and test connection
    const client = createAxonPulsClient({
      url,
      token,
      autoReconnect: false,
      debug: options.verbose,
    });

    // Add connection event handlers
    let connected = false;

    client.on('connected', () => {
      connected = true;
      spinner.succeed('Connection successful!');

      console.log();
      console.log(chalk.green('✓ Connected to AxonStream gateway'));
      console.log(chalk.blue('ℹ Connection details:'));
      console.log(`  Gateway: ${chalk.cyan(url)}`);
      console.log(`  Organization: ${chalk.cyan(organizationId)}`);
      console.log(`  User: ${chalk.cyan(tokenInfo.payload?.email || tokenInfo.payload?.sub)}`);
      console.log(`  Token expires: ${chalk.cyan(new Date((tokenInfo.payload?.exp || 0) * 1000).toLocaleString())}`);

      // Test basic functionality
      testBasicFunctionality(client);
    });

    client.on('error', (error: Error) => {
      if (!connected) {
        spinner.fail('Connection failed');
        console.error(chalk.red(`Connection error: ${error.message}`));
        process.exit(1);
      }
    });

    // Attempt connection with timeout
    const timeout = setTimeout(() => {
      if (!connected) {
        spinner.fail('Connection timeout');
        console.error(chalk.red('Connection timed out after 10 seconds'));
        process.exit(1);
      }
    }, 10000);

    await client.connect();
    clearTimeout(timeout);

  } catch (error: any) {
    spinner.fail('Connection failed');
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

async function testBasicFunctionality(client: any) {
  console.log();
  console.log(chalk.blue('ℹ Testing basic functionality...'));

  try {
    // Test ping
    const pingSpinner = ora('Testing ping...').start();

    let pongReceived = false;

    client.on('pong', () => {
      pongReceived = true;
      pingSpinner.succeed('Ping test successful');
    });

    // Send ping and wait for pong
    setTimeout(() => {
      if (!pongReceived) {
        pingSpinner.warn('Ping test inconclusive (no pong received)');
      }
    }, 2000);

    // Test channel validation
    const testSpinner = ora('Testing channel validation...').start();

    try {
      // Try to subscribe to a test channel
      const orgId = client.getOrganizationId();
      const testChannel = `org:${orgId}:cli-test`;

      await client.subscribe([testChannel]);
      testSpinner.succeed('Channel validation passed');

      // Unsubscribe
      await client.unsubscribe([testChannel]);

    } catch (error: any) {
      testSpinner.warn(`Channel validation test failed: ${error.message}`);
    }

    setTimeout(async () => {
      console.log(chalk.green('✓ Basic functionality tests completed'));
      console.log();
      console.log(chalk.yellow('Connection is ready! You can now:'));
      console.log(chalk.cyan('  axonstream subscribe org:your-org:channel'));
      console.log(chalk.cyan('  axonstream publish org:your-org:channel event.type \'{"data": "value"}\''));
      console.log(chalk.cyan('  axonstream monitor'));

      await client.disconnect();
      process.exit(0);
    }, 3000);

  } catch (error: any) {
    console.error(chalk.red(`Basic functionality test failed: ${error.message}`));
    await client.disconnect();
    process.exit(1);
  }
}
