/**
 * 🎯 ZERO-FRICTION ONBOARDING EXAMPLES
 * 
 * This demonstrates how users can start using AxonPuls immediately
 * without JWT tokens, registration, or complex setup
 */

const { createTrialClient, createDemoClient, createMagicClient, createZeroConfigClient } = require('@axonstream/core');

// 🚀 EXAMPLE 1: MAGIC ONE-LINER (Recommended)
async function magicOneLiner() {
    console.log('🎯 Magic One-Liner Example\n');
    
    try {
        // Just one line - user is ready to go!
        const axon = await createMagicClient('demo@example.com');
        
        console.log('✅ Connected! User can start immediately.');
        
        // Use all features right away
        await axon.subscribe(['demo-channel']);
        await axon.publish('demo-channel', {
            type: 'welcome',
            message: 'Hello from magic client!',
            timestamp: new Date().toISOString()
        });
        
        console.log('📤 Published welcome message');
        
        await axon.disconnect();
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// 🎭 EXAMPLE 2: ZERO CONFIG (No email needed)
async function zeroConfig() {
    console.log('🌟 Zero Config Example\n');
    
    try {
        // Literally zero configuration
        const axon = createZeroConfigClient();
        await axon.connect();
        
        console.log('✅ Connected with zero configuration!');
        
        // Full functionality available
        await axon.subscribe(['test-channel']);
        await axon.publish('test-channel', {
            message: 'Zero config works!'
        });
        
        console.log('📤 Published test message');
        
        await axon.disconnect();
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// 🚀 EXAMPLE 3: TRIAL MODE (7-day full access)
async function trialMode() {
    console.log('🚀 Trial Mode Example\n');
    
    try {
        const axon = await createTrialClient({
            email: 'trial-user@example.com',
            url: 'ws://localhost:3001',
            debug: true
        });
        
        console.log('✅ Trial client created and connected!');
        
        // Access to Magic collaboration features
        const { MagicCollaboration } = require('@axonstream/core');
        const magic = new MagicCollaboration(axon);
        
        // Create a collaborative room
        await magic.createRoom('trial-room', {
            content: 'Welcome to your trial!',
            users: []
        });
        
        console.log('🎭 Magic collaboration room created');
        
        await axon.disconnect();
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// 🎭 EXAMPLE 4: DEMO MODE (Instant access)
async function demoMode() {
    console.log('🎭 Demo Mode Example\n');
    
    try {
        const axon = createDemoClient({
            url: 'ws://localhost:3001',
            debug: true
        });
        
        await axon.connect();
        console.log('✅ Demo client connected!');
        
        // Set up event listeners
        axon.on('message', (data) => {
            console.log('📨 Received:', data);
        });
        
        // Subscribe and publish
        await axon.subscribe(['demo-events']);
        await axon.publish('demo-events', {
            type: 'demo',
            message: 'Demo mode is working!',
            features: ['real-time', 'collaboration', 'magic']
        });
        
        console.log('📤 Demo event published');
        
        await axon.disconnect();
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// 🌐 EXAMPLE 5: PRODUCTION UPGRADE PATH
async function productionUpgrade() {
    console.log('🌐 Production Upgrade Example\n');
    
    try {
        // Start with trial
        console.log('1. Starting with trial...');
        const trial = await createTrialClient({
            email: 'upgrade@example.com'
        });
        
        console.log('2. Using trial features...');
        await trial.subscribe(['upgrade-channel']);
        
        // When ready for production, easy upgrade
        console.log('3. Upgrading to production...');
        const { createAxonPulsClient } = require('@axonstream/core');
        
        const production = createAxonPulsClient({
            url: 'wss://your-org.axonstream.ai',
            token: 'your-production-jwt-token',
            mode: 'jwt',
            autoReconnect: true
        });
        
        await production.connect();
        console.log('✅ Upgraded to production!');
        
        // Same API, enterprise features
        await production.subscribe(['production-channel']);
        
        await trial.disconnect();
        await production.disconnect();
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Run all examples
async function runAllExamples() {
    console.log('🎯 AxonPuls Zero-Friction Onboarding Examples\n');
    console.log('='.repeat(50) + '\n');
    
    await magicOneLiner();
    console.log('\n' + '-'.repeat(50) + '\n');
    
    await zeroConfig();
    console.log('\n' + '-'.repeat(50) + '\n');
    
    await trialMode();
    console.log('\n' + '-'.repeat(50) + '\n');
    
    await demoMode();
    console.log('\n' + '-'.repeat(50) + '\n');
    
    await productionUpgrade();
    
    console.log('\n🎉 All examples completed!');
    console.log('\n📚 Next steps:');
    console.log('   • Visit https://docs.axonstream.ai for full documentation');
    console.log('   • Try the Magic collaboration features');
    console.log('   • Upgrade to production when ready');
}

// Run if called directly
if (require.main === module) {
    runAllExamples().catch(console.error);
}

module.exports = {
    magicOneLiner,
    zeroConfig,
    trialMode,
    demoMode,
    productionUpgrade
};
