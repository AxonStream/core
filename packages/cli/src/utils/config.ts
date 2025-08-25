import { readFileSync, writeFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import chalk from 'chalk';

interface CliConfig {
    gateway_url?: string;
    token?: string;
    organization_id?: string;
    default_output_format?: 'json' | 'table' | 'raw';
    auto_reconnect?: boolean;
    heartbeat_interval?: number;
    debug?: boolean;
}

const DEFAULT_CONFIG: CliConfig = {
    default_output_format: 'json',
    auto_reconnect: true,
    heartbeat_interval: 30,
    debug: false,
};

function getConfigPath(): string {
    return join(homedir(), '.axonstream');
}

export async function getConfig(): Promise<CliConfig> {
    const configPath = getConfigPath();

    try {
        if (!existsSync(configPath)) {
            return { ...DEFAULT_CONFIG };
        }

        const configContent = readFileSync(configPath, 'utf-8');
        const config = JSON.parse(configContent);

        return { ...DEFAULT_CONFIG, ...config };
    } catch (error) {
        console.error(chalk.yellow(`Warning: Failed to read config file: ${error}`));
        return { ...DEFAULT_CONFIG };
    }
}

export async function setConfig(key: string, value: any): Promise<void> {
    const configPath = getConfigPath();
    let config: CliConfig = {};

    try {
        if (existsSync(configPath)) {
            const configContent = readFileSync(configPath, 'utf-8');
            config = JSON.parse(configContent);
        }
    } catch (error) {
        console.error(chalk.yellow(`Warning: Failed to read existing config: ${error}`));
    }

    // Type conversion based on key
    switch (key) {
        case 'auto_reconnect':
        case 'debug':
            config[key as keyof CliConfig] = value === 'true' || value === true ? true : false;
            break;
        case 'heartbeat_interval':
            config[key as keyof CliConfig] = parseInt(value, 10) || 30;
            break;
        default:
            (config as any)[key] = value;
    }

    try {
        writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log(chalk.green(`✓ Configuration updated: ${key} = ${value}`));
    } catch (error) {
        console.error(chalk.red(`Failed to write config file: ${error}`));
        process.exit(1);
    }
}

export async function getConfigValue(key: string): Promise<any> {
    const config = await getConfig();
    return (config as any)[key];
}

export async function listConfig(): Promise<void> {
    const config = await getConfig();

    console.log(chalk.blue('Current configuration:'));
    console.log();

    for (const [key, value] of Object.entries(config)) {
        const displayValue = key === 'token' && value
            ? `${String(value).substring(0, 20)}...`
            : value;

        console.log(`  ${chalk.cyan(key)}: ${chalk.yellow(displayValue || 'not set')}`);
    }

    console.log();
    console.log(chalk.gray(`Config file: ${getConfigPath()}`));
}

export async function resetConfig(): Promise<void> {
    const configPath = getConfigPath();

    try {
        writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
        console.log(chalk.green('✓ Configuration reset to defaults'));
    } catch (error) {
        console.error(chalk.red(`Failed to reset config: ${error}`));
        process.exit(1);
    }
}
