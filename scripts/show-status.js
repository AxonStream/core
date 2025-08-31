#!/usr/bin/env node

const axios = require('axios');

async function showPlatformStatus() {
    console.log('🔍 Checking AXONPULS Platform Status...\n');

    try {
        const response = await axios.get('http://localhost:3001/api/v1/status');
        const data = response.data;

        console.log('🎉 AXONPULS Platform Status:');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log(`📋 Service: ${data.service}`);
        console.log(`🏢 Organization: ${data.organization}`);
        console.log(`🌐 Website: ${data.website}`);
        console.log(`📦 Version: ${data.version}`);
        console.log(`🌍 Environment: ${data.environment}`);
        console.log(`⏰ Uptime: ${Math.round(data.uptime)} seconds`);
        console.log('');

        console.log('🔧 System Components:');
        console.log('───────────────────────────────────────────────────────────────');

        const components = data.components;
        Object.entries(components).forEach(([component, status]) => {
            const icon = status === 'operational' ? '✅' : '❌';
            const statusText = status === 'operational' ? 'Operational' : 'Issues Detected';
            console.log(`${icon} ${component.charAt(0).toUpperCase() + component.slice(1)}: ${statusText}`);
        });

        console.log('');
        console.log('📊 Memory Usage:');
        console.log('───────────────────────────────────────────────────────────────');
        const mem = data.memory;
        const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
        const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
        console.log(`💾 Heap Used: ${heapUsedMB}MB / ${heapTotalMB}MB`);
        console.log(`📈 RSS: ${Math.round(mem.rss / 1024 / 1024)}MB`);

        console.log('');
        console.log('🔗 Quick Links:');
        console.log('───────────────────────────────────────────────────────────────');
        console.log('📚 API Documentation: http://localhost:3001/docs');
        console.log('🔍 Health Check: http://localhost:3001/api/v1/status');
        console.log('🌐 Frontend: http://localhost:3000');
        console.log('🔧 Backend API: http://localhost:3001');

        console.log('');
        console.log('✅ Platform is running successfully!');

    } catch (error) {
        console.error('❌ Failed to get platform status:');
        console.error('   Make sure the platform is running on http://localhost:3001');
        console.error('   Error:', error.message);
        process.exit(1);
    }
}

// Run the status check
showPlatformStatus();
