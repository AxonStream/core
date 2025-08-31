/**
 * 🎯 INVISIBLE TRIAL MODE EXAMPLE - ZERO FRICTION ONBOARDING
 *
 * This example shows how users can immediately try AxonStream
 * without any registration, tokens, or complex setup.
 *
 * Following market standards from Stripe, SendGrid, Twilio
 */

const { createAxonStream } = require('@axonstream/core');

async function invisibleTrialExample() {
  console.log('🚀 Starting AxonStream Invisible Trial...\n');

  try {
    // ✅ STEP 1: Start invisible trial (no token visible to user)
    console.log('📝 Starting invisible trial...');
    const response = await fetch('http://localhost:3001/auth/trial/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'demo@example.com' // Email for security validation
      })
    });

    const trialResult = await response.json();

    if (trialResult.accessGranted) {
      console.log('✅ Trial access granted!');
      console.log('📋 Trial Info:', trialResult.trialInfo);

      // ✅ STEP 2: Create client with invisible trial mode
      const axon = await createAxonStream({
        mode: 'invisible-trial',
        email: 'demo@example.com', // Same email used for trial
        debug: true,
        baseUrl: 'http://localhost:3001'
      });

      // ✅ STEP 3: Use immediately - no token management needed!
      await axon.connect();
      console.log('🔗 Connected to AxonStream!');

      // Subscribe to a channel
      await axon.subscribe('demo-channel');
      console.log('📡 Subscribed to demo-channel');

      // Publish an event
      await axon.publish('demo-channel', {
        type: 'demo-event',
        message: 'Hello from invisible trial!',
        timestamp: new Date().toISOString()
      });
      console.log('📤 Published demo event');

    } else {
      console.log('❌ Trial access denied');
    }

  } catch (error) {
    console.error('❌ Trial failed:', error.message);
  }
}

// Legacy trial example with visible tokens
async function legacyTrialExample() {
  console.log('🚀 Starting AxonStream Legacy Trial...\n');

  try {
    // ✅ STEP 1: Create trial client (automatic token generation)
    console.log('📝 Getting trial token...');
    const axon = await createAxonStream({
      mode: 'trial',
      debug: true,
      baseUrl: 'http://localhost:3001' // Your API URL
    });

    console.log('✅ Trial token received!');
    console.log('📊 Trial Info:', axon.trialInfo);
    console.log('');

    // ✅ STEP 2: Connect to WebSocket
    console.log('🔌 Connecting to AxonStream...');
    await axon.connect();
    console.log('✅ Connected successfully!\n');

    // ✅ STEP 3: Subscribe to trial channels
    console.log('📡 Subscribing to trial channels...');
    await axon.subscribe(['trial:general', 'trial:notifications']);
    console.log('✅ Subscribed to channels!\n');

    // ✅ STEP 4: Listen for events
    axon.on('event', (event) => {
      console.log('📨 Received event:', {
        type: event.type,
        channel: event.channel,
        payload: event.payload,
        timestamp: new Date(event.timestamp).toLocaleTimeString()
      });
    });

    // ✅ STEP 5: Publish test events
    console.log('📤 Publishing test events...');

    await axon.publish({
      channel: 'trial:general',
      type: 'user.joined',
      payload: {
        userId: 'trial-user-123',
        username: 'TrialUser',
        message: 'Hello from trial mode!'
      }
    });

    await axon.publish({
      channel: 'trial:notifications',
      type: 'system.notification',
      payload: {
        title: 'Welcome to AxonStream!',
        message: 'You are now connected to real-time events',
        priority: 'info'
      }
    });

    console.log('✅ Events published!\n');

    // ✅ STEP 6: Show trial limitations and next steps
    console.log('⏰ Trial Information:');
    console.log(`   • Expires: ${new Date(axon.trialInfo.expiresAt).toLocaleString()}`);
    console.log(`   • Organization: ${axon.trialInfo.organizationSlug}`);
    console.log(`   • User ID: ${axon.trialInfo.userId}`);
    console.log('');

    console.log('🚧 Trial Limitations:');
    axon.trialInfo.limitations.forEach(limitation => {
      console.log(`   • ${limitation}`);
    });
    console.log('');

    console.log('🎯 Available Features:');
    axon.trialInfo.features.forEach(feature => {
      console.log(`   • ${feature}`);
    });
    console.log('');

    console.log('🚀 Next Steps:');
    console.log(`   • Register: ${axon.trialInfo.nextSteps.register}`);
    console.log(`   • Documentation: ${axon.trialInfo.nextSteps.docs}`);
    console.log(`   • Examples: ${axon.trialInfo.nextSteps.examples}`);
    console.log('');

    // Keep connection alive for demo
    console.log('🔄 Keeping connection alive for 30 seconds...');
    console.log('   (You can publish more events or test real-time features)');

    setTimeout(async () => {
      console.log('\n🛑 Disconnecting...');
      await axon.disconnect();
      console.log('✅ Trial completed successfully!');
      console.log('\n💡 Ready to upgrade? Visit /auth/register');
    }, 30000);

  } catch (error) {
    console.error('❌ Trial failed:', error.message);

    if (error.message.includes('Trial period expired')) {
      console.log('\n💡 Your trial has expired. Register for full access:');
      console.log('   curl -X POST http://localhost:3001/auth/register \\');
      console.log('     -H "Content-Type: application/json" \\');
      console.log('     -d \'{"email":"you@example.com","password":"yourpassword","organizationName":"Your Company"}\'');
    }
  }
}

// Run examples
if (require.main === module) {
  console.log('Choose trial mode:');
  console.log('1. Invisible Trial (recommended)');
  console.log('2. Legacy Trial (with tokens)');

  const mode = process.argv[2] || '1';

  if (mode === '1' || mode === 'invisible') {
    invisibleTrialExample().catch(console.error);
  } else {
    legacyTrialExample().catch(console.error);
  }
}

module.exports = {
  invisibleTrialExample,
  legacyTrialExample,
  // Legacy export
  trialExample: legacyTrialExample
};
