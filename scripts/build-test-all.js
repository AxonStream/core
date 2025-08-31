#!/usr/bin/env node

/**
 * 🏗️ COMPREHENSIVE BUILD & TEST SYSTEM
 * 
 * This script:
 * 1. Type checks each package individually
 * 2. Builds each package separately
 * 3. Creates local test packages
 * 4. Tests all packages with real imports
 * 5. Provides one-command build for everything
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(type, message, data = null) {
    const timestamp = new Date().toISOString();
    const typeColors = {
        SUCCESS: colors.green,
        ERROR: colors.red,
        WARNING: colors.yellow,
        INFO: colors.blue,
        BUILD: colors.magenta,
        TEST: colors.cyan
    };

    const color = typeColors[type] || colors.reset;
    console.log(`${color}[${timestamp}] ${type}: ${message}${colors.reset}`);

    if (data) {
        console.log(`${colors.cyan}${JSON.stringify(data, null, 2)}${colors.reset}`);
    }
}

function runCommand(cmd, cwd = process.cwd()) {
    try {
        log('INFO', `Running: ${cmd} in ${cwd}`);
        const result = execSync(cmd, {
            cwd,
            stdio: 'pipe',
            encoding: 'utf8'
        });
        return { success: true, output: result };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            output: error.stdout || '',
            stderr: error.stderr || ''
        };
    }
}

// Package definitions
const packages = [
    {
        name: '@axonstream/core',
        path: 'packages/sdk',
        hasTypeCheck: true,
        hasBuild: true,
        testExports: ['AxonPulsClient', 'createAxonStream']
    },
    {
        name: '@axonstream/react',
        path: 'packages/react-hooks',
        hasTypeCheck: true,
        hasBuild: true,
        testExports: ['useAxonpuls', 'useAxonpulsChannel']
    },
    {
        name: '@axonstream/cli',
        path: 'packages/cli',
        hasTypeCheck: true,
        hasBuild: true,
        testExports: [] // CLI doesn't export classes, it's a command-line tool
    },
    {
        name: '@repo/ui',
        path: 'packages/ui',
        hasTypeCheck: true,
        hasBuild: false,
        testExports: [] // UI package doesn't have an index.ts - private internal package
    }
];

// Apps that need building
const apps = [
    {
        name: 'API Server',
        path: 'apps/api',
        hasTypeCheck: true,
        hasBuild: true
    },
    {
        name: 'Documentation',
        path: 'apps/docs',
        hasTypeCheck: true,
        hasBuild: true
    },
    {
        name: 'Web App',
        path: 'apps/web',
        hasTypeCheck: true,
        hasBuild: true
    }
];

async function main() {
    console.log(`${colors.bright}${colors.cyan}
╔══════════════════════════════════════════════════════════════╗
║                🏗️ AXONSTREAM BUILD & TEST SYSTEM             ║
║              Comprehensive Package Testing                  ║
╚══════════════════════════════════════════════════════════════╝
${colors.reset}`);

    const results = {
        packages: {},
        apps: {},
        tests: {},
        errors: []
    };

    // Step 1: Type check all packages
    log('BUILD', '🔍 Starting TypeScript type checking...');
    for (const pkg of packages) {
        if (pkg.hasTypeCheck) {
            log('INFO', `Type checking ${pkg.name}...`);
            const result = runCommand('npx tsc --noEmit', pkg.path);

            if (result.success) {
                log('SUCCESS', `✅ ${pkg.name} type check passed`);
                results.packages[pkg.name] = { typeCheck: 'passed' };
            } else {
                log('ERROR', `❌ ${pkg.name} type check failed`, {
                    error: result.error,
                    stderr: result.stderr
                });
                results.packages[pkg.name] = { typeCheck: 'failed', error: result.error };
                results.errors.push(`TypeCheck ${pkg.name}: ${result.error}`);
            }
        }
    }

    // Step 2: Build all packages
    log('BUILD', '🔨 Building all packages...');
    for (const pkg of packages) {
        if (pkg.hasBuild) {
            log('INFO', `Building ${pkg.name}...`);
            const result = runCommand('npm run build', pkg.path);

            if (result.success) {
                log('SUCCESS', `✅ ${pkg.name} build completed`);
                results.packages[pkg.name] = {
                    ...results.packages[pkg.name],
                    build: 'passed'
                };
            } else {
                log('ERROR', `❌ ${pkg.name} build failed`, {
                    error: result.error,
                    stderr: result.stderr
                });
                results.packages[pkg.name] = {
                    ...results.packages[pkg.name],
                    build: 'failed',
                    buildError: result.error
                };
                results.errors.push(`Build ${pkg.name}: ${result.error}`);
            }
        }
    }

    // Step 3: Create local test directory
    log('TEST', '🧪 Creating local test environment...');
    const testDir = 'test-local-packages';

    // Clean up existing test directory
    if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir);

    // Create package.json for testing
    const testPackageJson = {
        name: 'test-local-packages',
        version: '1.0.0',
        type: 'module',
        scripts: {
            test: 'node test-all.mjs'
        }
    };

    fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify(testPackageJson, null, 2)
    );

    // Step 4: Install packages locally for testing
    log('TEST', '📦 Installing packages locally...');
    for (const pkg of packages) {
        if (pkg.hasBuild && results.packages[pkg.name]?.build === 'passed') {
            const installResult = runCommand(
                `npm install ../${pkg.path}`,
                testDir
            );

            if (installResult.success) {
                log('SUCCESS', `✅ ${pkg.name} installed locally`);
                results.packages[pkg.name] = {
                    ...results.packages[pkg.name],
                    localInstall: 'passed'
                };
            } else {
                log('ERROR', `❌ ${pkg.name} local install failed`);
                results.packages[pkg.name] = {
                    ...results.packages[pkg.name],
                    localInstall: 'failed'
                };
                results.errors.push(`Install ${pkg.name}: ${installResult.error}`);
            }
        }
    }

    // Step 5: Create comprehensive test file
    log('TEST', '📝 Creating comprehensive test suite...');
    const testContent = generateTestContent(packages);
    fs.writeFileSync(path.join(testDir, 'test-all.mjs'), testContent);

    // Step 6: Run tests
    log('TEST', '🧪 Running comprehensive tests...');
    const testResult = runCommand('npm test', testDir);

    if (testResult.success) {
        log('SUCCESS', '✅ All package tests passed!');
        results.tests.comprehensive = 'passed';
    } else {
        log('ERROR', '❌ Package tests failed', {
            error: testResult.error,
            stderr: testResult.stderr
        });
        results.tests.comprehensive = 'failed';
        results.errors.push(`Tests: ${testResult.error}`);
    }

    // Step 7: Type check and build apps
    log('BUILD', '🏢 Building applications...');
    for (const app of apps) {
        if (app.hasTypeCheck) {
            log('INFO', `Type checking ${app.name}...`);
            const typeResult = runCommand('npx tsc --noEmit', app.path);

            results.apps[app.name] = {
                typeCheck: typeResult.success ? 'passed' : 'failed'
            };

            if (!typeResult.success) {
                results.errors.push(`App TypeCheck ${app.name}: ${typeResult.error}`);
            }
        }

        if (app.hasBuild) {
            log('INFO', `Building ${app.name}...`);
            const buildResult = runCommand('npm run build', app.path);

            results.apps[app.name] = {
                ...results.apps[app.name],
                build: buildResult.success ? 'passed' : 'failed'
            };

            if (buildResult.success) {
                log('SUCCESS', `✅ ${app.name} built successfully`);
            } else {
                log('ERROR', `❌ ${app.name} build failed`);
                results.errors.push(`App Build ${app.name}: ${buildResult.error}`);
            }
        }
    }

    // Final Report
    console.log('\n' + '='.repeat(70));
    log('INFO', '📊 FINAL BUILD & TEST REPORT');
    console.log('='.repeat(70));

    // Package Results
    console.log('\n📦 PACKAGES:');
    for (const [name, result] of Object.entries(results.packages)) {
        const typeCheck = result.typeCheck === 'passed' ? '✅' : '❌';
        const build = result.build === 'passed' ? '✅' : '❌';
        const install = result.localInstall === 'passed' ? '✅' : '❌';

        console.log(`  ${name}:`);
        console.log(`    Type Check: ${typeCheck} ${result.typeCheck}`);
        console.log(`    Build: ${build} ${result.build}`);
        console.log(`    Local Install: ${install} ${result.localInstall}`);
    }

    // App Results
    console.log('\n🏢 APPLICATIONS:');
    for (const [name, result] of Object.entries(results.apps)) {
        const typeCheck = result.typeCheck === 'passed' ? '✅' : '❌';
        const build = result.build === 'passed' ? '✅' : '❌';

        console.log(`  ${name}:`);
        console.log(`    Type Check: ${typeCheck} ${result.typeCheck}`);
        console.log(`    Build: ${build} ${result.build}`);
    }

    // Test Results
    console.log('\n🧪 TESTS:');
    const testStatus = results.tests.comprehensive === 'passed' ? '✅' : '❌';
    console.log(`  Comprehensive Tests: ${testStatus} ${results.tests.comprehensive}`);

    // Error Summary
    if (results.errors.length > 0) {
        console.log('\n❌ ERRORS:');
        results.errors.forEach((error, i) => {
            console.log(`  ${i + 1}. ${error}`);
        });
    }

    // Success Summary
    const totalChecks = Object.keys(results.packages).length * 3 + Object.keys(results.apps).length * 2 + 1;
    const passedChecks = Object.values(results.packages).reduce((acc, pkg) => {
        return acc +
            (pkg.typeCheck === 'passed' ? 1 : 0) +
            (pkg.build === 'passed' ? 1 : 0) +
            (pkg.localInstall === 'passed' ? 1 : 0);
    }, 0) + Object.values(results.apps).reduce((acc, app) => {
        return acc +
            (app.typeCheck === 'passed' ? 1 : 0) +
            (app.build === 'passed' ? 1 : 0);
    }, 0) + (results.tests.comprehensive === 'passed' ? 1 : 0);

    const successRate = ((passedChecks / totalChecks) * 100).toFixed(1);

    console.log('\n' + '='.repeat(70));
    if (results.errors.length === 0) {
        log('SUCCESS', `🎉 ALL CHECKS PASSED! (${successRate}%)`);
        log('SUCCESS', '✅ All packages built and tested successfully');
        log('SUCCESS', '✅ Ready for production deployment');
    } else {
        log('ERROR', `❌ ${results.errors.length} errors found (${successRate}% success rate)`);
        log('ERROR', '🔧 Fix errors before deployment');
    }
    console.log('='.repeat(70));

    // Exit with appropriate code
    process.exit(results.errors.length > 0 ? 1 : 0);
}

function generateTestContent(packages) {
    return `#!/usr/bin/env node

/**
 * 🧪 COMPREHENSIVE LOCAL PACKAGE TESTS
 * Generated by build-test-all.js
 */

console.log('🚀 Testing All Local Packages\\n');

let allPassed = true;
const results = [];

${packages.map(pkg => `
// Test ${pkg.name}
console.log('🧪 Testing ${pkg.name}...');
try {
    ${pkg.testExports.length > 0 ? pkg.testExports.map(exp => `
    const { ${exp} } = await import('${pkg.name}');
    if (typeof ${exp} === 'undefined') {
        throw new Error('${exp} is undefined');
    }
    console.log('  ✅ ${exp}: ' + typeof ${exp});`).join('') : `
    // Package doesn't export classes, just check if it can be imported
    const packageModule = await import('${pkg.name}');
    console.log('  ✅ Package imported successfully');`}
    
    results.push({ package: '${pkg.name}', status: 'passed' });
    console.log('✅ ${pkg.name} - ALL EXPORTS OK\\n');
} catch (error) {
    console.log('❌ ${pkg.name} - FAILED:', error.message);
    results.push({ package: '${pkg.name}', status: 'failed', error: error.message });
    allPassed = false;
}
`).join('')}

// Summary
console.log('=' .repeat(50));
console.log('📊 PACKAGE TEST RESULTS:');
console.log('=' .repeat(50));

results.forEach(result => {
    const status = result.status === 'passed' ? '✅ PASSED' : '❌ FAILED';
    console.log(\`  \${result.package}: \${status}\`);
    if (result.error) {
        console.log(\`    Error: \${result.error}\`);
    }
});

const passedCount = results.filter(r => r.status === 'passed').length;
const totalCount = results.length;
const successRate = ((passedCount / totalCount) * 100).toFixed(1);

console.log('\\n' + '='.repeat(50));
if (allPassed) {
    console.log(\`🎉 ALL PACKAGES WORKING! (\${successRate}%)\`);
    console.log('✅ Ready for publishing');
} else {
    console.log(\`❌ \${totalCount - passedCount} packages failed (\${successRate}% success rate)\`);
    console.log('🔧 Fix issues before publishing');
}
console.log('='.repeat(50));

process.exit(allPassed ? 0 : 1);
`;
}

// Run the main function
main().catch(error => {
    log('ERROR', 'Script failed:', error);
    process.exit(1);
});
