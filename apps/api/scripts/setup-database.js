#!/usr/bin/env node

/**
 * 🔧 AxonStream Database Setup Script
 * 
 * This script helps users set up their database quickly and handles common issues
 * - Tests database connection
 * - Creates database if it doesn't exist
 * - Runs migrations
 * - Provides helpful error messages and solutions
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

class DatabaseSetup {
    constructor() {
        this.dbUrl = process.env.DATABASE_URL;
        this.steps = [];
        this.errors = [];
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = {
            'info': '💡',
            'success': '✅',
            'error': '❌',
            'warning': '⚠️',
            'step': '🔧'
        }[type] || '📋';

        console.log(`[${timestamp}] ${prefix} ${message}`);
    }

    async run() {
        this.log('🚀 AxonStream Database Setup Starting...', 'step');
        this.log('');

        try {
            await this.checkEnvironment();
            await this.testConnection();
            await this.ensureDatabaseExists();
            await this.runMigrations();
            await this.generatePrismaClient();
            await this.seedDatabase();
            await this.runBootstrapTest();

            this.log('');
            this.log('🎉 Database setup completed successfully!', 'success');
            this.log('');
            this.log('📋 Setup Summary:');
            this.steps.forEach((step, index) => {
                this.log(`   ${index + 1}. ${step}`, 'info');
            });

        } catch (error) {
            this.log('');
            this.log('💥 Database setup failed!', 'error');
            this.log('');
            this.log('🔍 Error Details:', 'error');
            this.log(`   ${error.message}`, 'error');

            if (this.errors.length > 0) {
                this.log('');
                this.log('🆘 Troubleshooting Steps:', 'warning');
                this.errors.forEach((solution, index) => {
                    this.log(`   ${index + 1}. ${solution}`, 'warning');
                });
            }

            this.showQuickFixGuide();
            process.exit(1);
        }
    }

    async checkEnvironment() {
        this.log('Checking environment configuration...', 'step');

        if (!this.dbUrl) {
            this.errors.push('Set DATABASE_URL in your .env file');
            this.errors.push('Example: DATABASE_URL="postgresql://user:password@localhost:5432/dbname"');
            throw new Error('DATABASE_URL is not set in environment variables');
        }

        // Parse and validate DATABASE_URL
        try {
            const url = new URL(this.dbUrl);
            this.dbConfig = {
                host: url.hostname,
                port: parseInt(url.port) || 5432,
                username: url.username,
                password: url.password,
                database: url.pathname.replace('/', ''),
                protocol: url.protocol
            };

            if (this.dbConfig.protocol !== 'postgresql:') {
                throw new Error('Only PostgreSQL is supported currently');
            }

            this.log(`Database: ${this.dbConfig.database} on ${this.dbConfig.host}:${this.dbConfig.port}`, 'info');
            this.steps.push('Environment configuration validated');

        } catch (error) {
            this.errors.push('Check your DATABASE_URL format');
            this.errors.push('Correct format: postgresql://username:password@host:port/database');
            throw new Error(`Invalid DATABASE_URL: ${error.message}`);
        }
    }

    async testConnection() {
        this.log('Testing database connection...', 'step');

        try {
            // Test connection using psql command
            const testCommand = `psql "${this.dbUrl}" -c "SELECT 1 as connection_test;"`;
            execSync(testCommand, { stdio: 'pipe' });

            this.log('Database connection successful!', 'success');
            this.steps.push('Database connection verified');

        } catch (error) {
            // Try to determine the specific issue
            const errorMsg = error.message || error.toString();

            if (errorMsg.includes('psql: command not found')) {
                this.errors.push('Install PostgreSQL client tools (psql)');
                this.errors.push('On Ubuntu/Debian: sudo apt-get install postgresql-client');
                this.errors.push('On macOS: brew install postgresql');
                this.errors.push('Or use Docker: docker exec -it postgres_container psql');
                throw new Error('PostgreSQL client (psql) is not installed');
            }

            if (errorMsg.includes('Connection refused') || errorMsg.includes('could not connect')) {
                this.errors.push('Start your PostgreSQL server');
                this.errors.push('If using Docker: docker-compose up -d postgres');
                this.errors.push('Check if PostgreSQL is running on the correct port');
                throw new Error('Cannot connect to PostgreSQL server');
            }

            if (errorMsg.includes('database') && errorMsg.includes('does not exist')) {
                this.log('Database does not exist, will create it...', 'warning');
                return; // We'll handle this in ensureDatabaseExists
            }

            if (errorMsg.includes('authentication failed')) {
                this.errors.push('Check your database username and password');
                this.errors.push('Verify credentials in your DATABASE_URL');
                throw new Error('Database authentication failed');
            }

            throw new Error(`Database connection failed: ${errorMsg}`);
        }
    }

    async ensureDatabaseExists() {
        this.log('Ensuring database exists...', 'step');

        try {
            // Try to connect to the specific database
            const testDbCommand = `psql "${this.dbUrl}" -c "SELECT current_database();"`;
            execSync(testDbCommand, { stdio: 'pipe' });

            this.log('Database exists and is accessible', 'success');
            this.steps.push('Database existence confirmed');

        } catch (error) {
            this.log('Database does not exist, creating it...', 'warning');

            try {
                // Connect to postgres database to create the target database
                const postgresUrl = this.dbUrl.replace(
                    `/${this.dbConfig.database}`,
                    '/postgres'
                );

                const createDbCommand = `psql "${postgresUrl}" -c "CREATE DATABASE ${this.dbConfig.database};"`;
                execSync(createDbCommand, { stdio: 'pipe' });

                this.log(`Database '${this.dbConfig.database}' created successfully!`, 'success');
                this.steps.push(`Database '${this.dbConfig.database}' created`);

            } catch (createError) {
                const createErrorMsg = createError.message || createError.toString();

                if (createErrorMsg.includes('already exists')) {
                    this.log('Database already exists', 'success');
                    this.steps.push('Database existence confirmed');
                } else {
                    this.errors.push('Ensure you have CREATE DATABASE permissions');
                    this.errors.push('Try manually: createdb -U username database_name');
                    throw new Error(`Failed to create database: ${createErrorMsg}`);
                }
            }
        }
    }

    async runMigrations() {
        this.log('Running database migrations...', 'step');

        try {
            // Check if there are any migrations to run
            const statusCommand = 'npx prisma migrate status';
            const statusOutput = execSync(statusCommand, { encoding: 'utf8', stdio: 'pipe' });

            if (statusOutput.includes('No pending migrations')) {
                this.log('No pending migrations found', 'info');
                this.steps.push('Database schema is up to date');
                return;
            }

            // Run migrations
            const migrateCommand = 'npx prisma migrate deploy';
            execSync(migrateCommand, { stdio: 'inherit' });

            this.log('Database migrations completed!', 'success');
            this.steps.push('Database migrations applied');

        } catch (error) {
            const errorMsg = error.message || error.toString();

            if (errorMsg.includes('No migration found')) {
                this.log('No migrations found, initializing...', 'warning');

                try {
                    const initCommand = 'npx prisma migrate dev --name init';
                    execSync(initCommand, { stdio: 'inherit' });
                    this.steps.push('Initial migration created and applied');
                } catch (initError) {
                    this.errors.push('Check your Prisma schema file');
                    this.errors.push('Run: npx prisma validate');
                    throw new Error(`Migration initialization failed: ${initError.message}`);
                }
            } else {
                this.errors.push('Check your database permissions');
                this.errors.push('Ensure the database user can create tables');
                throw new Error(`Migration failed: ${errorMsg}`);
            }
        }
    }

    async generatePrismaClient() {
        this.log('Generating Prisma client...', 'step');

        try {
            execSync('npx prisma generate', { stdio: 'pipe' });
            this.log('Prisma client generated successfully!', 'success');
            this.steps.push('Prisma client generated');

        } catch (error) {
            this.errors.push('Check your Prisma schema syntax');
            this.errors.push('Run: npx prisma validate');
            throw new Error(`Prisma client generation failed: ${error.message}`);
        }
    }

    async seedDatabase() {
        this.log('Checking for database seeds...', 'step');

        const seedFile = path.join(process.cwd(), 'prisma', 'seed.ts');
        if (!fs.existsSync(seedFile)) {
            this.log('No seed file found, skipping...', 'info');
            return;
        }

        try {
            this.log('Running database seeds...', 'step');
            execSync('npm run db:seed', { stdio: 'inherit' });
            this.log('Database seeded successfully!', 'success');
            this.steps.push('Database seeded with initial data');

        } catch (error) {
            this.log('Seeding failed, but database setup is complete', 'warning');
            this.steps.push('Database ready (seeding skipped due to errors)');
        }
    }

    async runBootstrapTest() {
        this.log('Testing database bootstrap system...', 'step');

        try {
            // Run bootstrap test without affecting metrics
            execSync('npm run db:bootstrap:test', { stdio: 'pipe' });
            this.log('Database bootstrap test passed!', 'success');
            this.steps.push('Database bootstrap system verified');

        } catch (error) {
            this.log('Bootstrap test failed, but database is functional', 'warning');
            this.log('You can run bootstrap manually: npm run db:bootstrap', 'info');
            this.steps.push('Database ready (bootstrap test skipped)');
        }
    }

    showQuickFixGuide() {
        this.log('');
        this.log('🆘 QUICK FIX GUIDE', 'error');
        this.log('='.repeat(50), 'error');
        this.log('');
        this.log('🐳 Option 1: Use Docker (Easiest)', 'info');
        this.log('   docker-compose up -d postgres', 'info');
        this.log('   npm run db:setup', 'info');
        this.log('');
        this.log('💻 Option 2: Local PostgreSQL', 'info');
        this.log('   # Install PostgreSQL locally', 'info');
        this.log('   sudo apt-get install postgresql postgresql-contrib', 'info');
        this.log('   sudo -u postgres createuser -P myuser', 'info');
        this.log('   sudo -u postgres createdb -O myuser mydatabase', 'info');
        this.log('');
        this.log('☁️  Option 3: Cloud Database', 'info');
        this.log('   # Get a connection string from:', 'info');
        this.log('   # - Heroku Postgres', 'info');
        this.log('   # - Railway', 'info');
        this.log('   # - Supabase', 'info');
        this.log('   # - AWS RDS', 'info');
        this.log('');
        this.log('🔧 Need help? Check:', 'info');
        this.log('   - https://docs.axonstream.ai/database-setup', 'info');
        this.log('   - GitHub Issues: https://github.com/AxonStream/core/issues', 'info');
    }
}

// Run the setup
const setup = new DatabaseSetup();
setup.run().catch((error) => {
    console.error('Setup script failed:', error.message);
    process.exit(1);
});
