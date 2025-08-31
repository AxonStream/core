import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import axios from 'axios';
import { getConfig, setConfig } from '../utils/config';
import { validateToken, displayTokenInfo } from '../utils/auth';

interface AuthResponse {
    user: {
        id: string;
        email: string;
        organizationId: string;
        organization: {
            id: string;
            name: string;
            slug: string;
        };
    };
    organization: {
        id: string;
        name: string;
        slug: string;
    };
    accessToken: string;
    refreshToken: string;
}

interface LoginCredentials {
    email: string;
    password: string;
    organizationSlug?: string;
}

export async function authCommand(command: any, options?: any) {
    const action = command?.args?.[0] || 'status';

    switch (action) {
        case 'status':
            await showAuthStatus();
            break;
        case 'token':
            await handleTokenCommand(options);
            break;
        case 'login':
            await handleLogin(options);
            break;
        case 'logout':
            await handleLogout();
            break;
        default:
            console.log(chalk.red(`Unknown auth command: ${action}`));
            process.exit(1);
    }
}

async function showAuthStatus() {
    const config = await getConfig();
    const token = config.token || process.env.AxonPuls_TOKEN;

    if (!token) {
        console.log(chalk.yellow('⚠ Not authenticated'));
        console.log(chalk.blue('Set your token using:'));
        console.log(chalk.cyan('  AxonPuls config set token <your-jwt-token>'));
        console.log(chalk.blue('Or set environment variable:'));
        console.log(chalk.cyan('  export AxonPuls_TOKEN=<your-jwt-token>'));
        return;
    }

    displayTokenInfo(token);
}

async function handleTokenCommand(options: any) {
    const config = await getConfig();
    const token = config.token || process.env.AxonPuls_TOKEN;

    if (!token) {
        console.log(chalk.red('No token found'));
        return;
    }

    if (options?.decode) {
        displayTokenInfo(token);
    } else if (options?.validate) {
        const result = validateToken(token);
        if (result.valid) {
            console.log(chalk.green('✓ Token is valid'));
        } else {
            console.log(chalk.red('✗ Token is invalid'));
            console.log(chalk.red(`  Error: ${result.error}`));
        }
    } else {
        console.log(chalk.cyan(token));
    }
}

async function handleLogin(options: any) {
    const config = await getConfig();
    const gatewayUrl = config.gateway_url || process.env.AxonPuls_GATEWAY_URL;

    if (!gatewayUrl) {
        console.error(chalk.red('Gateway URL not configured'));
        console.log(chalk.blue('Set gateway URL using:'));
        console.log(chalk.cyan('  AxonPuls config set gateway_url <url>'));
        process.exit(1);
    }

    // Check if already logged in
    if (config.token) {
        const tokenInfo = validateToken(config.token);
        if (tokenInfo.valid) {
            console.log(chalk.yellow('Already authenticated'));
            displayTokenInfo(config.token);
            return;
        }
    }

    const spinner = ora('Authenticating...').start();

    try {
        // For now, prompt for manual token entry
        // TODO: Implement proper login flow with API
        spinner.stop();

        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'email',
                message: 'Email:',
                validate: (input) => input.includes('@') || 'Please enter a valid email'
            },
            {
                type: 'input',
                name: 'organizationSlug',
                message: 'Organization Slug (optional):',
                default: ''
            },
            {
                type: 'password',
                name: 'password',
                message: 'Password:',
                mask: '*'
            }
        ]);

        spinner.start('Authenticating...');

        // Attempt to authenticate with API
        const authUrl = gatewayUrl.replace(/\/+$/, '') + '/api/v1/auth/login';

        const loginData: LoginCredentials = {
            email: answers.email,
            password: answers.password
        };

        if (answers.organizationSlug) {
            loginData.organizationSlug = answers.organizationSlug;
        }

        const response = await axios.post<AuthResponse>(authUrl, loginData);

        if (response.data && response.data.accessToken) {
            await setConfig('token', response.data.accessToken);

            spinner.succeed('Authentication successful!');
            console.log(chalk.green('✓ Logged in successfully'));

            // Display token info
            displayTokenInfo(response.data.accessToken);
        } else {
            throw new Error('Invalid response from server');
        }

    } catch (error: any) {
        spinner.fail('Authentication failed');

        if (error.response?.status === 401) {
            console.error(chalk.red('Invalid email or password'));
        } else if (error.response?.status === 404) {
            console.error(chalk.red('Authentication endpoint not found'));
            console.log(chalk.yellow('For now, set your token manually:'));
            console.log(chalk.cyan('  AxonPuls config set token <your-jwt-token>'));
        } else {
            console.error(chalk.red(`Authentication error: ${error.message}`));
        }

        process.exit(1);
    }
}

async function handleLogout() {
    try {
        await setConfig('token', '');
        console.log(chalk.green('✓ Logged out successfully'));
    } catch (error) {
        console.error(chalk.red('Failed to logout'));
    }
}
