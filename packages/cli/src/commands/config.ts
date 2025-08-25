import chalk from 'chalk';
import { getConfig, setConfig, getConfigValue, listConfig, resetConfig } from '../utils/config';

export async function configCommand(command: any, options?: any) {
    const action = command?.args?.[0] || 'list';

    switch (action) {
        case 'set':
            await handleSet(command.args[1], command.args[2]);
            break;
        case 'get':
            await handleGet(command.args[1]);
            break;
        case 'list':
            await listConfig();
            break;
        case 'reset':
            await handleReset();
            break;
        default:
            console.log(chalk.red(`Unknown config command: ${action}`));
            process.exit(1);
    }
}

async function handleSet(key: string, value: string) {
    if (!key || value === undefined) {
        console.error(chalk.red('Usage: AxonPuls config set <key> <value>'));
        process.exit(1);
    }

    await setConfig(key, value);
}

async function handleGet(key: string) {
    if (!key) {
        console.error(chalk.red('Usage: AxonPuls config get <key>'));
        process.exit(1);
    }

    const value = await getConfigValue(key);

    if (value === undefined) {
        console.log(chalk.yellow(`Key '${key}' not found`));
    } else {
        // Mask sensitive values
        const displayValue = key === 'token' && value
            ? `${String(value).substring(0, 20)}...`
            : value;

        console.log(displayValue);
    }
}

async function handleReset() {
    console.log(chalk.yellow('This will reset all configuration to defaults.'));

    // Simple confirmation (in a real implementation, use inquirer)
    console.log(chalk.cyan('Resetting configuration...'));
    await resetConfig();
}
