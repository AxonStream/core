#!/usr/bin/env node

/**
 * Consolidation Validation Script
 * Validates that security fixes and consolidation steps are working correctly
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function error(message) {
  log(`❌ ${message}`, 'red');
}

function warning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function info(message) {
  log(`ℹ️  ${message}`, 'blue');
}

class ConsolidationValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.originalApiPath = 'apps/api';
    this.hardenedApiPath = 'apps/axonstream_api_hardened_full_v6/api';
  }

  // Validate that required files exist
  validateFileStructure() {
    info('Validating file structure...');
    
    const requiredFiles = [
      `${this.originalApiPath}/src/config/auth.config.ts`,
      `${this.originalApiPath}/src/config/database.config.ts`,
      `${this.originalApiPath}/src/config/config.utils.ts`,
      `${this.hardenedApiPath}/src/config/auth.config.ts`,
      `${this.hardenedApiPath}/src/config/database.config.ts`,
    ];

    let allFilesExist = true;
    
    requiredFiles.forEach(file => {
      if (fs.existsSync(file)) {
        success(`Found: ${file}`);
      } else {
        error(`Missing: ${file}`);
        this.errors.push(`Missing required file: ${file}`);
        allFilesExist = false;
      }
    });

    return allFilesExist;
  }

  // Validate that security fixes are applied
  validateSecurityFixes() {
    info('Validating security fixes...');
    
    const hardenedAuthConfig = path.join(this.hardenedApiPath, 'src/config/auth.config.ts');
    const hardenedDbConfig = path.join(this.hardenedApiPath, 'src/config/database.config.ts');
    
    let securityValid = true;

    // Check auth config
    if (fs.existsSync(hardenedAuthConfig)) {
      const authContent = fs.readFileSync(hardenedAuthConfig, 'utf8');
      
      if (authContent.includes('validateProductionSecrets')) {
        success('Auth config: validateProductionSecrets found');
      } else {
        error('Auth config: validateProductionSecrets missing');
        this.errors.push('Auth config missing validateProductionSecrets');
        securityValid = false;
      }

      if (authContent.includes('safeParseInt')) {
        success('Auth config: safeParseInt found');
      } else {
        error('Auth config: safeParseInt missing');
        this.errors.push('Auth config missing safeParseInt');
        securityValid = false;
      }
    }

    // Check database config
    if (fs.existsSync(hardenedDbConfig)) {
      const dbContent = fs.readFileSync(hardenedDbConfig, 'utf8');
      
      if (dbContent.includes('validateProductionSecrets')) {
        success('Database config: validateProductionSecrets found');
      } else {
        error('Database config: validateProductionSecrets missing');
        this.errors.push('Database config missing validateProductionSecrets');
        securityValid = false;
      }

      if (dbContent.includes('safeParseInt')) {
        success('Database config: safeParseInt found');
      } else {
        error('Database config: safeParseInt missing');
        this.errors.push('Database config missing safeParseInt');
        securityValid = false;
      }

      // Check for unsafe parseInt usage
      if (dbContent.includes('parseInt(process.env')) {
        error('Database config: Unsafe parseInt usage found');
        this.errors.push('Database config contains unsafe parseInt usage');
        securityValid = false;
      } else {
        success('Database config: No unsafe parseInt usage');
      }
    }

    return securityValid;
  }

  // Validate TypeScript compilation
  validateTypeScriptCompilation() {
    info('Validating TypeScript compilation...');
    
    const apis = [
      { name: 'Original API', path: this.originalApiPath },
      { name: 'Hardened API', path: this.hardenedApiPath }
    ];

    let compilationValid = true;

    apis.forEach(api => {
      try {
        process.chdir(api.path);
        execSync('npx tsc --noEmit', { stdio: 'pipe' });
        success(`${api.name}: TypeScript compilation successful`);
        process.chdir('../../');
      } catch (error) {
        error(`${api.name}: TypeScript compilation failed`);
        this.errors.push(`${api.name} TypeScript compilation failed`);
        compilationValid = false;
        process.chdir('../../');
      }
    });

    return compilationValid;
  }

  // Check for code duplication
  validateCodeDuplication() {
    info('Checking for code duplication...');
    
    const eventReplayOriginal = path.join(this.originalApiPath, 'src/common/services/event-replay.service.ts');
    const eventReplayHardened = path.join(this.hardenedApiPath, 'src/common/services/event-replay.service.ts');
    
    if (fs.existsSync(eventReplayOriginal) && fs.existsSync(eventReplayHardened)) {
      const originalContent = fs.readFileSync(eventReplayOriginal, 'utf8');
      const hardenedContent = fs.readFileSync(eventReplayHardened, 'utf8');
      
      if (originalContent === hardenedContent) {
        warning('Code duplication detected: event-replay.service.ts is identical');
        this.warnings.push('event-replay.service.ts is duplicated');
      } else {
        success('event-replay.service.ts files are different');
      }
    }

    return true;
  }

  // Validate environment configuration
  validateEnvironmentConfig() {
    info('Validating environment configuration...');
    
    const envExample = path.join(this.originalApiPath, '.env.example');
    const productionEnv = '.env.production';
    
    if (fs.existsSync(envExample)) {
      success('Environment example file found');
    } else {
      warning('Environment example file missing');
      this.warnings.push('Missing .env.example file');
    }

    if (fs.existsSync(productionEnv)) {
      success('Production environment file found');
    } else {
      warning('Production environment file missing');
      this.warnings.push('Missing .env.production file');
    }

    return true;
  }

  // Run all validations
  async runValidation() {
    log('\n🔍 Starting Consolidation Validation...\n', 'blue');
    
    const validations = [
      { name: 'File Structure', fn: () => this.validateFileStructure() },
      { name: 'Security Fixes', fn: () => this.validateSecurityFixes() },
      { name: 'TypeScript Compilation', fn: () => this.validateTypeScriptCompilation() },
      { name: 'Code Duplication', fn: () => this.validateCodeDuplication() },
      { name: 'Environment Config', fn: () => this.validateEnvironmentConfig() }
    ];

    let allValid = true;

    for (const validation of validations) {
      log(`\n--- ${validation.name} ---`, 'blue');
      const result = validation.fn();
      if (!result) {
        allValid = false;
      }
    }

    // Summary
    log('\n📊 Validation Summary', 'blue');
    log('='.repeat(50), 'blue');
    
    if (this.errors.length === 0) {
      success('No critical errors found');
    } else {
      error(`${this.errors.length} critical error(s) found:`);
      this.errors.forEach(err => error(`  • ${err}`));
    }

    if (this.warnings.length === 0) {
      success('No warnings');
    } else {
      warning(`${this.warnings.length} warning(s):`);
      this.warnings.forEach(warn => warning(`  • ${warn}`));
    }

    if (allValid && this.errors.length === 0) {
      success('\n🎉 All validations passed! Ready for next phase.');
    } else {
      error('\n❌ Validation failed. Please fix errors before proceeding.');
    }

    return allValid && this.errors.length === 0;
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new ConsolidationValidator();
  validator.runValidation().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = ConsolidationValidator;
