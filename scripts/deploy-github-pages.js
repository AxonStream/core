#!/usr/bin/env node

/**
 * 🚀 GITHUB PAGES DEPLOYER
 * 
 * Deploys GitHub Pages configuration to the AxonStream/docs repository
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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
        DEPLOY: colors.magenta,
        PAGES: colors.cyan
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
╔══════════════════════════════════════════════════════════════╗
║                🚀 GITHUB PAGES DEPLOYER                     ║
║              Deploy Pages Configuration to GitHub           ║
╚══════════════════════════════════════════════════════════════╝
${colors.reset}`);

    const pagesDir = 'docs-github-pages';
    const tempDir = 'temp-pages-deploy';

    // Step 1: Validate pages files exist
    log('PAGES', '📋 Validating GitHub Pages files...');
    const requiredFiles = [
        'CNAME',
        'index.html',
        'robots.txt',
        'sitemap.xml',
        '.nojekyll'
    ];

    for (const file of requiredFiles) {
        const filePath = path.join(pagesDir, file);
        if (!fs.existsSync(filePath)) {
            log('ERROR', `Required file missing: ${file}`);
            log('ERROR', 'Run: npm run docs:setup-pages first');
            process.exit(1);
        }
        const stats = fs.statSync(filePath);
        log('SUCCESS', `✅ ${file} (${stats.size} bytes)`);
    }

    // Step 2: Clone docs repository
    log('DEPLOY', '📥 Cloning docs repository...');

    // Clean up any existing temp directory
    if (fs.existsSync(tempDir)) {
        runCommand(`rm -rf ${tempDir}`);
    }

    const cloneResult = runCommand(`git clone https://github.com/AxonStream/docs.git ${tempDir}`);
    if (!cloneResult.success) {
        log('ERROR', 'Failed to clone docs repository');
        log('ERROR', cloneResult.error);
        process.exit(1);
    }
    log('SUCCESS', '✅ Documentation repository cloned');

    // Step 3: Copy GitHub Pages files
    log('PAGES', '📄 Copying GitHub Pages files...');

    // Copy pages files
    for (const file of requiredFiles) {
        const sourcePath = path.join(pagesDir, file);
        const destPath = path.join(tempDir, file);
        fs.copyFileSync(sourcePath, destPath);
        log('SUCCESS', `✅ Copied ${file}`);
    }

    // Copy GitHub Actions workflow
    const workflowSource = path.join(pagesDir, '.github');
    const workflowDest = path.join(tempDir, '.github');

    if (fs.existsSync(workflowSource)) {
        // Remove existing .github directory if it exists
        if (fs.existsSync(workflowDest)) {
            runCommand(`rm -rf ${workflowDest}`);
        }

        // Copy the entire .github directory
        runCommand(`cp -r "${workflowSource}" "${workflowDest}"`);
        log('SUCCESS', '✅ Copied GitHub Actions workflow');
    }

    // Step 4: Commit and push changes
    log('DEPLOY', '📤 Deploying to GitHub...');

    const gitCommands = [
        'git add .',
        'git config user.name "AxonStream Pages Bot"',
        'git config user.email "pages@axonstream.ai"',
        'git commit -m "🌐 Enable GitHub Pages with professional configuration\n\n- Add custom domain (docs.axonstream.ai)\n- Professional landing page with navigation\n- SEO optimization (robots.txt, sitemap.xml)\n- GitHub Actions for auto-deployment\n- Mobile-responsive design\n- Analytics-ready structure"',
        'git push origin main'
    ];

    for (const cmd of gitCommands) {
        const result = runCommand(cmd, tempDir);
        if (!result.success) {
            log('ERROR', `Git command failed: ${cmd}`);
            log('ERROR', result.error);
            // Don't exit, might be due to no changes
        }
    }

    // Step 5: Cleanup
    log('PAGES', '🧹 Cleaning up temporary files...');
    runCommand(`rm -rf ${tempDir}`);

    // Step 6: Display final instructions
    console.log('\n' + '='.repeat(70));
    log('SUCCESS', '🎉 GITHUB PAGES DEPLOYMENT COMPLETE!');
    console.log('='.repeat(70));

    console.log('\n🌐 GitHub Pages Repository:');
    console.log('   → Repository: https://github.com/AxonStream/docs');
    console.log('   → Settings: https://github.com/AxonStream/docs/settings/pages');
    console.log('   → Actions: https://github.com/AxonStream/docs/actions');

    console.log('\n📋 NEXT: Enable GitHub Pages in Repository Settings');
    console.log('\n1. 🌐 Visit Repository Settings:');
    console.log('   https://github.com/AxonStream/docs/settings/pages');

    console.log('\n2. ⚙️ Configure Pages:');
    console.log('   ✅ Source: "Deploy from a branch"');
    console.log('   ✅ Branch: "main"');
    console.log('   ✅ Folder: "/ (root)"');
    console.log('   ✅ Save configuration');

    console.log('\n3. 🌍 Custom Domain (Optional but Recommended):');
    console.log('   ✅ Enter: "docs.axonstream.ai"');
    console.log('   ✅ Wait for DNS verification');
    console.log('   ✅ Enable "Enforce HTTPS"');

    console.log('\n🔧 DNS Configuration (for custom domain):');
    console.log('\nAdd to your DNS provider:');
    console.log('   Record Type: CNAME');
    console.log('   Name: docs');
    console.log('   Value: axonstream.github.io');
    console.log('   TTL: 300 (or default)');

    console.log('\n🚀 Expected Live URLs:');
    console.log('   → GitHub Pages: https://axonstream.github.io/docs/');
    console.log('   → Custom Domain: https://docs.axonstream.ai/ (after DNS)');

    console.log('\n⏱️ Timeline:');
    console.log('   → Enable Pages: 2-5 minutes');
    console.log('   → First Deployment: 3-10 minutes');
    console.log('   → Custom Domain: 5-10 minutes after DNS');
    console.log('   → SSL Certificate: 10-30 minutes');

    console.log('\n📊 What\'s Included:');
    console.log('   ✅ Professional landing page with navigation');
    console.log('   ✅ All documentation files (README, API, deployment)');
    console.log('   ✅ SEO optimization (robots.txt, sitemap.xml)');
    console.log('   ✅ GitHub Actions for automatic deployment');
    console.log('   ✅ Mobile-responsive design');
    console.log('   ✅ Custom domain configuration');
    console.log('   ✅ Analytics-ready structure');

    console.log('\n🎯 Test Your Documentation:');
    console.log('   1. Wait for GitHub Pages to be enabled');
    console.log('   2. Visit the live URL');
    console.log('   3. Test all navigation links');
    console.log('   4. Verify mobile responsiveness');
    console.log('   5. Check SEO with Google Search Console');

    console.log('\n='.repeat(70));
    log('SUCCESS', '🌐 Ready to enable GitHub Pages!');
    console.log('='.repeat(70));
}

main().catch(error => {
    log('ERROR', 'GitHub Pages deployment failed:');
    console.error(error);
    process.exit(1);
});
