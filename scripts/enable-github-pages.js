#!/usr/bin/env node

/**
 * 🌐 GITHUB PAGES ENABLER
 * 
 * Enables GitHub Pages for the AxonStream/docs repository
 * and configures it for professional documentation hosting
 */

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
        PAGES: colors.magenta,
        CONFIG: colors.cyan
    };

    const color = typeColors[type] || colors.reset;
    console.log(`${color}[${timestamp}] ${type}: ${message}${colors.reset}`);
}

async function main() {
    console.log(`${colors.cyan}
╔══════════════════════════════════════════════════════════════╗
║                🌐 GITHUB PAGES CONFIGURATION                 ║
║              Professional Documentation Hosting             ║
╚══════════════════════════════════════════════════════════════╝
${colors.reset}`);

    // Step 1: Create CNAME file for custom domain (if needed)
    log('CONFIG', '🔧 Creating CNAME configuration...');

    const cnameContent = `docs.axonstream.ai`;
    const cnameDir = 'docs-github-pages';

    if (!fs.existsSync(cnameDir)) {
        fs.mkdirSync(cnameDir, { recursive: true });
    }

    fs.writeFileSync(path.join(cnameDir, 'CNAME'), cnameContent);
    log('SUCCESS', '✅ CNAME file created for docs.axonstream.ai');

    // Step 2: Create .nojekyll file to disable Jekyll processing if needed
    fs.writeFileSync(path.join(cnameDir, '.nojekyll'), '');
    log('SUCCESS', '✅ .nojekyll file created (for custom processing)');

    // Step 3: Create index.html redirect for immediate access
    const indexHtmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AxonStream Documentation</title>
    <meta name="description" content="Enterprise-grade real-time platform with WebSocket infrastructure, multi-tenant architecture, and production-ready APIs.">
    
    <!-- SEO Meta Tags -->
    <meta property="og:title" content="AxonStream Neural Infrastructure Documentation">
    <meta property="og:description" content="Enterprise-grade real-time platform documentation">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://docs.axonstream.ai">
    <meta property="og:image" content="https://docs.axonstream.ai/assets/logo.png">
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="AxonStream Documentation">
    <meta name="twitter:description" content="Enterprise-grade real-time platform documentation">
    
    <!-- Canonical URL -->
    <link rel="canonical" href="https://docs.axonstream.ai">
    
    <!-- Favicon -->
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    
    <!-- Redirect to README if accessing root -->
    <script>
        // If GitHub Pages is serving this file, redirect to README
        if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
            window.location.href = '/README.md';
        }
    </script>
    
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            line-height: 1.6;
            color: #24292e;
            background: #ffffff;
            margin: 0;
            padding: 2rem;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            text-align: center;
        }
        .logo {
            width: 120px;
            height: 120px;
            margin: 0 auto 2rem;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 3rem;
            color: white;
        }
        .title {
            font-size: 2.5rem;
            margin-bottom: 1rem;
            color: #2c3e50;
        }
        .subtitle {
            font-size: 1.2rem;
            color: #7f8c8d;
            margin-bottom: 2rem;
        }
        .nav-links {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin: 2rem 0;
        }
        .nav-link {
            display: block;
            padding: 1rem;
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            text-decoration: none;
            color: #495057;
            transition: all 0.3s ease;
        }
        .nav-link:hover {
            background: #e9ecef;
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        .nav-link h3 {
            margin: 0 0 0.5rem 0;
            color: #2c3e50;
        }
        .nav-link p {
            margin: 0;
            font-size: 0.9rem;
        }
        .status-badge {
            display: inline-block;
            background: #28a745;
            color: white;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-size: 0.8rem;
            margin-left: 0.5rem;
        }
        .footer {
            margin-top: 3rem;
            padding-top: 2rem;
            border-top: 1px solid #e9ecef;
            color: #6c757d;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🧠</div>
        <h1 class="title">AxonStream Documentation</h1>
        <p class="subtitle">
            Enterprise-grade real-time platform with WebSocket infrastructure
            <span class="status-badge">v2.0.0 Live</span>
        </p>
        
        <div class="nav-links">
            <a href="README.md" class="nav-link">
                <h3>📚 Overview</h3>
                <p>Architecture, features, and getting started guide</p>
            </a>
            
            <a href="quickstart.md" class="nav-link">
                <h3>🚀 Quick Start</h3>
                <p>Get up and running in under 5 minutes</p>
            </a>
            
            <a href="api-reference.md" class="nav-link">
                <h3>📖 API Reference</h3>
                <p>Complete SDK documentation and examples</p>
            </a>
            
            <a href="deployment.md" class="nav-link">
                <h3>🏗️ Deployment</h3>
                <p>Production deployment with Docker & Kubernetes</p>
            </a>
            
            <a href="examples/react-example.md" class="nav-link">
                <h3>💻 Examples</h3>
                <p>Framework integration examples and tutorials</p>
            </a>
            
            <a href="https://www.npmjs.com/package/@axonstream/core" class="nav-link" target="_blank">
                <h3>📦 npm Package</h3>
                <p>Install the SDK and start building</p>
            </a>
        </div>
        
        <div class="footer">
            <p>
                <strong>AxonStream Neural Infrastructure</strong><br>
                Built with ❤️ by the AxonStream team<br>
                <a href="https://github.com/AxonStream">GitHub</a> · 
                <a href="https://www.npmjs.com/package/@axonstream/core">npm</a> · 
                <a href="https://github.com/AxonStream/docs/issues">Support</a>
            </p>
        </div>
    </div>

    <!-- Analytics (add your tracking code here) -->
    <script>
        // Google Analytics placeholder
        // gtag('config', 'GA_TRACKING_ID');
    </script>
</body>
</html>`;

    fs.writeFileSync(path.join(cnameDir, 'index.html'), indexHtmlContent);
    log('SUCCESS', '✅ Professional index.html created');

    // Step 4: Create GitHub Actions workflow for automated deployment
    const workflowDir = path.join(cnameDir, '.github', 'workflows');
    fs.mkdirSync(workflowDir, { recursive: true });

    const workflowContent = `name: Deploy Documentation to GitHub Pages

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        
      - name: Setup Pages
        uses: actions/configure-pages@v4
        
      - name: Build with Jekyll
        uses: actions/jekyll-build-pages@v1
        with:
          source: ./
          destination: ./_site
          
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3

  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
`;

    fs.writeFileSync(path.join(workflowDir, 'deploy.yml'), workflowContent);
    log('SUCCESS', '✅ GitHub Actions workflow created');

    // Step 5: Create robots.txt for SEO
    const robotsContent = `User-agent: *
Allow: /

# Sitemaps
Sitemap: https://docs.axonstream.ai/sitemap.xml

# Allow search engines to index documentation
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

# Crawl-delay for respectful crawling
Crawl-delay: 1
`;

    fs.writeFileSync(path.join(cnameDir, 'robots.txt'), robotsContent);
    log('SUCCESS', '✅ robots.txt created for SEO');

    // Step 6: Create sitemap.xml
    const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://docs.axonstream.ai/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://docs.axonstream.ai/README.md</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://docs.axonstream.ai/quickstart.md</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://docs.axonstream.ai/api-reference.md</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://docs.axonstream.ai/deployment.md</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://docs.axonstream.ai/examples/react-example.md</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>`;

    fs.writeFileSync(path.join(cnameDir, 'sitemap.xml'), sitemapContent);
    log('SUCCESS', '✅ sitemap.xml created');

    // Step 7: Instructions for enabling GitHub Pages
    console.log('\n' + '='.repeat(70));
    log('PAGES', '🌐 GITHUB PAGES SETUP INSTRUCTIONS');
    console.log('='.repeat(70));

    console.log('\n📋 Manual Steps to Enable GitHub Pages:');
    console.log('\n1. 🌐 Go to GitHub Repository Settings:');
    console.log('   → Visit: https://github.com/AxonStream/docs/settings/pages');

    console.log('\n2. ⚙️ Configure Pages Source:');
    console.log('   → Source: "Deploy from a branch"');
    console.log('   → Branch: "main" (or "gh-pages" if you prefer)');
    console.log('   → Folder: "/ (root)"');

    console.log('\n3. 🌍 Custom Domain (Optional):');
    console.log('   → Enter: "docs.axonstream.ai"');
    console.log('   → Wait for DNS verification');

    console.log('\n4. 🔐 HTTPS Settings:');
    console.log('   → ✅ Check "Enforce HTTPS"');

    console.log('\n5. 📁 Upload Additional Files:');
    console.log('   → Copy files from docs-github-pages/ to your docs repository');
    console.log('   → Commit and push changes');

    console.log('\n🔧 DNS Configuration (if using custom domain):');
    console.log('\nAdd these DNS records to your domain:');
    console.log('   Type: CNAME');
    console.log('   Name: docs');
    console.log('   Value: axonstream.github.io');

    console.log('\n🚀 Expected URLs after setup:');
    console.log('   → Default: https://axonstream.github.io/docs/');
    console.log('   → Custom:  https://docs.axonstream.ai/ (if DNS configured)');

    console.log('\n⏱️ Timeline:');
    console.log('   → GitHub Pages: 2-5 minutes after enabling');
    console.log('   → Custom Domain: 5-10 minutes after DNS setup');
    console.log('   → SSL Certificate: 10-30 minutes after domain verification');

    console.log('\n📊 Features Included:');
    console.log('   ✅ Professional landing page');
    console.log('   ✅ SEO optimization (robots.txt, sitemap.xml)');
    console.log('   ✅ GitHub Actions for auto-deployment');
    console.log('   ✅ Custom domain support');
    console.log('   ✅ Mobile-responsive design');
    console.log('   ✅ Analytics-ready');

    console.log('\n🎯 Next Steps:');
    console.log('   1. Enable GitHub Pages in repository settings');
    console.log('   2. Upload the generated files from docs-github-pages/');
    console.log('   3. Configure custom domain (optional)');
    console.log('   4. Add Google Analytics tracking ID');
    console.log('   5. Test all documentation links');

    console.log('\n='.repeat(70));
    log('SUCCESS', '🎉 GitHub Pages configuration ready!');
    console.log('='.repeat(70));
}

main().catch(error => {
    log('ERROR', 'GitHub Pages setup failed:');
    console.error(error);
    process.exit(1);
});
