#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { config } from 'dotenv';
import { version } from '../package.json';

// Load environment variables
config();

// Import command modules
import { connectCommand } from './commands/connect';
import { publishCommand } from './commands/publish';
import { subscribeCommand } from './commands/subscribe';
import { replayCommand } from './commands/replay';
import { monitorCommand } from './commands/monitor';
import { authCommand } from './commands/auth';
import { configCommand } from './commands/config';
import { testCommand } from './commands/test';

const program = new Command();

// Configure main CLI
program
    .name('axonstream')
    .description('AxonStream Core CLI - Manage real-time events and connections')
    .version(version)
    .option('-c, --config <path>', 'Configuration file path', '.axonstreamrc')
    .option('-v, --verbose', 'Enable verbose logging')
    .option('--no-color', 'Disable colored output')
    .hook('preAction', (thisCommand) => {
        if (thisCommand.opts().noColor) {
            chalk.level = 0;
        }
    });

// Connection management
program
    .command('connect')
    .description('Test connection to AxonPuls gateway')
    .option('-u, --url <url>', 'Gateway WebSocket URL')
    .option('-t, --token <token>', 'Authentication token')
    .option('-o, --org <orgId>', 'Organization ID')
    .action(connectCommand);

// Event publishing
program
    .command('publish')
    .description('Publish event to channel')
    .argument('<channel>', 'Channel name (e.g., org:myorg:notifications)')
    .argument('<type>', 'Event type')
    .argument('[payload]', 'Event payload (JSON string)')
    .option('-f, --file <path>', 'Read payload from file')
    .option('-i, --interactive', 'Interactive payload input')
    .option('-d, --delivery <guarantee>', 'Delivery guarantee (at_least_once|at_most_once)')
    .option('-k, --partition-key <key>', 'Partition key')
    .action(publishCommand);

// Event subscription
program
    .command('subscribe')
    .description('Subscribe to channels and listen for events')
    .argument('<channels...>', 'Channel names to subscribe to')
    .option('-r, --replay-from <id>', 'Replay events from stream ID')
    .option('-n, --replay-count <count>', 'Number of events to replay', '100')
    .option('-f, --filter <filter>', 'Event filter pattern')
    .option('-o, --output <format>', 'Output format (json|table|raw)', 'json')
    .option('--save <file>', 'Save events to file')
    .action(subscribeCommand);

// Event replay
program
    .command('replay')
    .description('Replay historical events from channel')
    .argument('<channel>', 'Channel name')
    .option('-s, --since <id>', 'Start from stream ID')
    .option('-n, --count <count>', 'Number of events to replay', '100')
    .option('-o, --output <format>', 'Output format (json|table|raw)', 'json')
    .option('--save <file>', 'Save events to file')
    .action(replayCommand);

// Real-time monitoring
program
    .command('monitor')
    .description('Monitor platform health and metrics')
    .option('-i, --interval <seconds>', 'Refresh interval', '5')
    .option('-m, --metrics <types>', 'Metrics to show (connections,events,errors)', 'connections,events,errors')
    .option('--dashboard', 'Show interactive dashboard')
    .action(monitorCommand);

// Authentication management
program
    .command('auth')
    .description('Manage authentication and tokens')
    .addCommand(
        new Command('login')
            .description('Login and store authentication token')
            .option('-u, --username <username>', 'Username')
            .option('-p, --password <password>', 'Password')
            .option('-e, --endpoint <url>', 'Authentication endpoint')
    )
    .addCommand(
        new Command('logout')
            .description('Logout and clear stored token')
    )
    .addCommand(
        new Command('status')
            .description('Show current authentication status')
    )
    .addCommand(
        new Command('token')
            .description('Manage JWT tokens')
            .option('-d, --decode', 'Decode and display token')
            .option('-v, --validate', 'Validate token')
    )
    .action(authCommand);

// Configuration management
program
    .command('config')
    .description('Manage CLI configuration')
    .addCommand(
        new Command('set')
            .description('Set configuration value')
            .argument('<key>', 'Configuration key')
            .argument('<value>', 'Configuration value')
    )
    .addCommand(
        new Command('get')
            .description('Get configuration value')
            .argument('<key>', 'Configuration key')
    )
    .addCommand(
        new Command('list')
            .description('List all configuration values')
    )
    .addCommand(
        new Command('reset')
            .description('Reset configuration to defaults')
    )
    .action(configCommand);

// Testing and debugging
program
    .command('test')
    .description('Test AxonPuls platform functionality')
    .addCommand(
        new Command('connection')
            .description('Test WebSocket connection')
            .option('-c, --count <count>', 'Number of connection attempts', '1')
            .option('-t, --timeout <ms>', 'Connection timeout', '10000')
    )
    .addCommand(
        new Command('latency')
            .description('Measure round-trip latency')
            .option('-c, --count <count>', 'Number of pings', '10')
            .option('-i, --interval <ms>', 'Ping interval', '1000')
    )
    .addCommand(
        new Command('throughput')
            .description('Test event throughput')
            .option('-e, --events <count>', 'Number of events to send', '1000')
            .option('-c, --concurrent <count>', 'Concurrent connections', '1')
            .option('-s, --size <bytes>', 'Event payload size', '1024')
    )
    .action(testCommand);

// Completion and global error handling
program
    .configureHelp({
        sortSubcommands: true,
        showGlobalOptions: true,
    })
    .showHelpAfterError()
    .exitOverride();

// Global error handler
process.on('uncaughtException', (error) => {
    console.error(chalk.red('Uncaught Exception:'), error.message);
    if (program.opts().verbose) {
        console.error(error.stack);
    }
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.red('Unhandled Rejection at:'), promise, chalk.red('reason:'), reason);
    process.exit(1);
});

// Parse command line arguments
if (require.main === module) {
    program.parse(process.argv);
}

export { program };
