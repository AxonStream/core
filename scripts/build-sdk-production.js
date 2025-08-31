#!/usr/bin/env node

/**
 * 🚀 PRODUCTION SDK BUILD & TEST
 * Focused on SDK package only for production release
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(type, message) {
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
}

function runCommand(cmd, cwd = process.cwd()) {
    try {
        log('INFO', `Running: ${cmd}`);
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

async function main() {
    console.log(`${colors.cyan}
╔═══════════════════════════════════════════════════════════╗
║                🚀 SDK PRODUCTION BUILD                    ║
║              Ready for Publishing                        ║
╚═══════════════════════════════════════════════════════════╝
${colors.reset}`);

    const sdkPath = 'packages/sdk';
    let allPassed = true;

    // Step 1: Type check
    log('BUILD', '🔍 Type checking SDK...');
    const typeResult = runCommand('npx tsc --noEmit', sdkPath);
    if (typeResult.success) {
        log('SUCCESS', '✅ SDK type check passed');
    } else {
        log('ERROR', '❌ SDK type check failed');
        console.log(typeResult.stderr);
        allPassed = false;
    }

    // Step 2: Build
    log('BUILD', '🔨 Building SDK...');
    const buildResult = runCommand('npm run build', sdkPath);
    if (buildResult.success) {
        log('SUCCESS', '✅ SDK build completed');
    } else {
        log('ERROR', '❌ SDK build failed');
        console.log(buildResult.stderr);
        allPassed = false;
    }

    // Step 3: Local test
    if (allPassed) {
        log('TEST', '🧪 Testing SDK locally...');
        const testResult = runCommand('node test-sdk-local.mjs', sdkPath);
        if (testResult.success) {
            log('SUCCESS', '✅ SDK local test passed');
            console.log(testResult.output);
        } else {
            log('ERROR', '❌ SDK local test failed');
            console.log(testResult.stderr);
            allPassed = false;
        }
    }

    // Step 4: Package info
    if (allPassed) {
        log('INFO', '📦 Package information:');
        const packageJson = JSON.parse(fs.readFileSync(path.join(sdkPath, 'package.json'), 'utf8'));
        console.log(`   Name: ${packageJson.name}`);
        console.log(`   Version: ${packageJson.version}`);
        console.log(`   Description: ${packageJson.description}`);

        // Check dist size
        const distPath = path.join(sdkPath, 'dist');
        if (fs.existsSync(distPath)) {
            const files = fs.readdirSync(distPath, { recursive: true });
            console.log(`   Dist files: ${files.length}`);

            // Check key files
            const keyFiles = ['index.js', 'index.cjs', 'index.d.ts'];
            keyFiles.forEach(file => {
                const filePath = path.join(distPath, file);
                if (fs.existsSync(filePath)) {
                    const stats = fs.statSync(filePath);
                    console.log(`   ${file}: ${(stats.size / 1024).toFixed(1)} KB`);
                }
            });
        }
    }

    // Final result
    console.log('\n' + '='.repeat(50));
    if (allPassed) {
        log('SUCCESS', '🎉 SDK IS PRODUCTION READY!');
        log('SUCCESS', '✅ All checks passed');
        log('SUCCESS', '✅ Ready to publish');
        console.log('\n📝 Next steps:');
        console.log('   1. npm version patch|minor|major');
        console.log('   2. npm publish');
        console.log('   3. git add . && git commit -m "Release vX.X.X"');
        console.log('   4. git push origin main');
    } else {
        log('ERROR', '❌ SDK has issues');
        log('ERROR', '🔧 Fix issues before publishing');
    }
    console.log('='.repeat(50));

    process.exit(allPassed ? 0 : 1);
}

main().catch(error => {
    log('ERROR', 'Script failed:', error);
    process.exit(1);
});
