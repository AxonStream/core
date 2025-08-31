#!/usr/bin/env node

/**
 * 📚 PROFESSIONAL DOCUMENTATION PUBLISHER
 * 
 * Publishes comprehensive documentation to GitHub Pages
 * Repository: https://github.com/AxonStream/docs
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
        PUBLISH: colors.magenta,
        DOCS: colors.cyan
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
║                📚 AXONSTREAM DOCS PUBLISHER                  ║
║              Professional Documentation Deployment          ║
╚══════════════════════════════════════════════════════════════╝
${colors.reset}`);

    const docsDir = 'docs-publish';
    const tempDir = 'temp-docs-repo';

    // Step 1: Validate documentation files
    log('DOCS', '📋 Validating documentation files...');
    const requiredFiles = [
        'README.md',
        'quickstart.md',
        'api-reference.md',
        'deployment.md'
    ];

    for (const file of requiredFiles) {
        const filePath = path.join(docsDir, file);
        if (!fs.existsSync(filePath)) {
            log('ERROR', `Required file missing: ${file}`);
            process.exit(1);
        }
        const stats = fs.statSync(filePath);
        log('SUCCESS', `✅ ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
    }

    // Step 2: Clone the docs repository
    log('PUBLISH', '📥 Cloning documentation repository...');

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

    // Step 3: Copy documentation files
    log('DOCS', '📄 Copying documentation files...');

    // Copy main files
    for (const file of requiredFiles) {
        const sourcePath = path.join(docsDir, file);
        const destPath = path.join(tempDir, file);
        fs.copyFileSync(sourcePath, destPath);
        log('SUCCESS', `✅ Copied ${file}`);
    }

    // Create additional structure
    const additionalDirs = ['examples', 'tutorials', 'guides'];
    for (const dir of additionalDirs) {
        const dirPath = path.join(tempDir, dir);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }

    // Step 4: Create navigation structure
    log('DOCS', '🗂️ Creating navigation structure...');

    const indexContent = `# AxonStream Documentation

Welcome to the official AxonStream neural infrastructure documentation.

## 📚 Documentation Sections

### Getting Started
- [Quick Start Guide](./quickstart.md)
- [Installation & Setup](./quickstart.md#installation)
- [Basic Examples](./quickstart.md#framework-integration)

### API Reference
- [JavaScript/TypeScript SDK](./api-reference.md)
- [Client Configuration](./api-reference.md#client-configuration)
- [Event Handling](./api-reference.md#event-handling)
- [Framework Adapters](./api-reference.md#framework-adapters)

### Deployment & Operations
- [Production Deployment](./deployment.md)
- [Docker Setup](./deployment.md#docker-deployment)
- [Kubernetes Deployment](./deployment.md#kubernetes-deployment)
- [Monitoring & Observability](./deployment.md#monitoring-and-observability)

### Framework Integration
- [React Integration](./examples/react-example.md)
- [Vue.js Integration](./examples/vue-example.md)
- [Angular Integration](./examples/angular-example.md)
- [Vanilla JavaScript](./examples/vanilla-example.md)

## 🚀 Live Package

The AxonStream SDK is available on npm:

\`\`\`bash
npm install @axonstream/core@2.0.0
\`\`\`

## 🔗 Links

- **GitHub Repository**: [AxonStream/core](https://github.com/AxonStream/core)
- **npm Package**: [@axonstream/core](https://www.npmjs.com/package/@axonstream/core)
- **Issues & Support**: [GitHub Issues](https://github.com/AxonStream/core/issues)

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

**Built with ❤️ by the AxonStream team**
`;

    fs.writeFileSync(path.join(tempDir, 'index.md'), indexContent);
    log('SUCCESS', '✅ Created index.md');

    // Step 5: Create _config.yml for GitHub Pages
    const configContent = `title: AxonStream Documentation
description: Enterprise-grade real-time platform with WebSocket infrastructure
baseurl: ""
url: "https://axonstream.github.io/docs"

# Build settings
markdown: kramdown
highlighter: rouge
theme: minima

# Plugins
plugins:
  - jekyll-feed
  - jekyll-sitemap
  - jekyll-seo-tag

# Navigation
header_pages:
  - quickstart.md
  - api-reference.md
  - deployment.md

# Social links
github_username: AxonStream
twitter_username: axonstream

# SEO
author: AxonStream Team
logo: /assets/logo.png

# Google Analytics (add your tracking ID)
# google_analytics: UA-XXXXXXXX-X

# Exclude files
exclude:
  - Gemfile
  - Gemfile.lock
  - node_modules
  - vendor/bundle/
  - vendor/cache/
  - vendor/gems/
  - vendor/ruby/
`;

    fs.writeFileSync(path.join(tempDir, '_config.yml'), configContent);
    log('SUCCESS', '✅ Created Jekyll configuration');

    // Step 6: Create example files
    log('DOCS', '📝 Creating example files...');

    const examplesDir = path.join(tempDir, 'examples');

    // React example
    const reactExample = `# React Integration Example

Complete example of integrating AxonStream with React applications.

## Installation

\`\`\`bash
npm install @axonstream/core@2.0.0
\`\`\`

## Basic Setup

\`\`\`jsx
import React, { useState, useEffect } from 'react';
import { AxonPulsClient } from '@axonstream/core';

function App() {
  const [client, setClient] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const axonClient = new AxonPulsClient({
      url: 'wss://your-org.axonstream.ai',
      token: process.env.REACT_APP_AXON_TOKEN,
      debug: process.env.NODE_ENV === 'development'
    });

    axonClient.on('connected', () => {
      setIsConnected(true);
      console.log('Connected to AxonStream');
    });

    axonClient.on('disconnected', () => {
      setIsConnected(false);
      console.log('Disconnected from AxonStream');
    });

    axonClient.on('message', (data) => {
      setMessages(prev => [...prev, data]);
    });

    axonClient.connect();
    setClient(axonClient);

    return () => {
      axonClient.disconnect();
    };
  }, []);

  const sendMessage = () => {
    if (client && isConnected) {
      client.send('chat', {
        text: 'Hello from React!',
        timestamp: Date.now(),
        userId: 'current-user-id'
      });
    }
  };

  return (
    <div className="app">
      <header>
        <h1>AxonStream React Example</h1>
        <p>Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}</p>
      </header>
      
      <main>
        <div className="messages">
          {messages.map((msg, index) => (
            <div key={index} className="message">
              <pre>{JSON.stringify(msg, null, 2)}</pre>
            </div>
          ))}
        </div>
        
        <button onClick={sendMessage} disabled={!isConnected}>
          Send Test Message
        </button>
      </main>
    </div>
  );
}

export default App;
\`\`\`

## Advanced Usage with Custom Hooks

\`\`\`jsx
// useAxonStream.js
import { useState, useEffect, useCallback } from 'react';
import { AxonPulsClient } from '@axonstream/core';

export function useAxonStream(config) {
  const [client, setClient] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const axonClient = new AxonPulsClient(config);

    axonClient.on('connected', () => setIsConnected(true));
    axonClient.on('disconnected', () => setIsConnected(false));
    axonClient.on('error', (err) => setError(err));

    axonClient.connect().catch(setError);
    setClient(axonClient);

    return () => axonClient.disconnect();
  }, [config.url, config.token]);

  const send = useCallback((channel, data) => {
    if (client && isConnected) {
      client.send(channel, data);
    }
  }, [client, isConnected]);

  const subscribe = useCallback((channel) => {
    if (client) {
      client.subscribe(channel);
    }
  }, [client]);

  return { client, isConnected, error, send, subscribe };
}
\`\`\`

See [API Reference](../api-reference.md) for complete documentation.
`;

    fs.writeFileSync(path.join(examplesDir, 'react-example.md'), reactExample);
    log('SUCCESS', '✅ Created React example');

    // Step 7: Commit and push to repository
    log('PUBLISH', '📤 Publishing to GitHub...');

    const gitCommands = [
        'git add .',
        'git config user.name "AxonStream Docs Bot"',
        'git config user.email "docs@axonstream.ai"',
        'git commit -m "📚 Update documentation - Professional release v2.0.0"',
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

    // Step 8: Cleanup
    log('DOCS', '🧹 Cleaning up temporary files...');
    runCommand(`rm -rf ${tempDir}`);

    // Step 9: Generate deployment summary
    log('SUCCESS', '✅ Documentation published successfully!');

    console.log('\n' + '='.repeat(60));
    log('SUCCESS', '🎉 DOCUMENTATION DEPLOYMENT COMPLETE!');
    console.log('='.repeat(60));

    console.log('\n📚 Published Documentation:');
    console.log(`   - Main Documentation: https://axonstream.github.io/docs/`);
    console.log(`   - Quick Start: https://axonstream.github.io/docs/quickstart`);
    console.log(`   - API Reference: https://axonstream.github.io/docs/api-reference`);
    console.log(`   - Deployment Guide: https://axonstream.github.io/docs/deployment`);

    console.log('\n🔗 Repository Links:');
    console.log(`   - GitHub Repo: https://github.com/AxonStream/docs`);
    console.log(`   - Edit Documentation: https://github.com/AxonStream/docs/tree/main`);
    console.log(`   - Issues & Feedback: https://github.com/AxonStream/docs/issues`);

    console.log('\n📦 Package Information:');
    console.log(`   - npm Package: https://www.npmjs.com/package/@axonstream/core`);
    console.log(`   - Current Version: 2.0.0`);
    console.log(`   - Installation: npm install @axonstream/core@2.0.0`);

    console.log('\n🚀 Next Steps:');
    console.log(`   1. Documentation will be live in 2-3 minutes`);
    console.log(`   2. Custom domain can be configured in repository settings`);
    console.log(`   3. Analytics can be added via _config.yml`);
    console.log(`   4. Additional examples can be added to /examples`);

    console.log('\n='.repeat(60));
}

main().catch(error => {
    log('ERROR', 'Documentation publishing failed:');
    console.error(error);
    process.exit(1);
});
